'use strict';

const MAX_NUMBER_OF_NEWS_IN_A_PAGE = 5;
const MAX_NUMBER_OF_WORDS_IN_SIMPLIFIED_CONTENT = 10;

const express = require('express');
const monk = require('monk');
const cookieParaser = require('cookie-parser')
const db = monk('localhost:27017/assignment1');


const app = express();

app.use(express.json());
app.use(cookieParaser());

app.use(express.static('public'), function (request, response, next) {
    request.db = db;
    next();
})

app.get('/', (req, res) => {
    res.sendFile(__dirname + "/public/" + "newsfeed.html");
});


app.post('/retrievenewslist', function (req, res) {
    const db = req.db;
    const col = db.collection('newsList');
    const searchString = req.body.searchString;
    const index = req.body.index;
    const searchObject = searchString == null || searchString === "" ? {} : {
        'headline': {
            $regex: searchString,
            $options: 'i'
        }
    };
    col.find(searchObject, {sort: {time: -1}}).then((docs) => {
        let list = [];
        for (let i = (index - 1) * MAX_NUMBER_OF_NEWS_IN_A_PAGE; i < index * MAX_NUMBER_OF_NEWS_IN_A_PAGE && i < docs.length; ++i) {
            const news = docs[i];
            let content = docs[i].content.split(' ');
            if (content.length > MAX_NUMBER_OF_WORDS_IN_SIMPLIFIED_CONTENT) {
                content = content.slice(0, MAX_NUMBER_OF_WORDS_IN_SIMPLIFIED_CONTENT);
                content.push('...');
            }
            content = content.join(' ');
            list.push({
                newsID: docs[i]._id,
                headline: docs[i].headline,
                'simplified-content': content,
                time: news.time,
                comments: news.comments,
            });
        }
        res.send(JSON.stringify({
            docs: list,
            numberOfPages: Math.ceil(docs.length / MAX_NUMBER_OF_NEWS_IN_A_PAGE),
            loginStatue: req.cookies.userID ? 1 : 0,
        }))
    })
});

app.get('/displayNewsEntry', (req, res) => {
    const db = req.db;
    const col = db.collection('newsList');
    col.findOne({_id: monk.id(req.query.newsID)}).then(async (doc) => {
        let file = '';
        file += `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <link rel="stylesheet" href="stylesheets/news-entry.css">
          <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">
          <script src="javascripts/script.js"></script>
          <meta name="viewport"
                content="width=device-width, user-scalable=no, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0">
          <meta http-equiv="X-UA-Compatible" content="ie=edge">
          <title>Document</title>
        </head>
        <div id="headline">
          <button id="back-button" class="center" onclick="location.href='/'">
            <i class="material-icons">
              <span class="material-icons-outlined">arrow_back</span>
            </i>
          </button>
          <h1>${doc.headline}</h1>
          <p>${doc.time.toLocaleString()}</p>
        </div>
        <p>
         ${doc.content}
        </p>
        `;

        file += `<div id="comments">`

        const comments = doc.comments.sort((a, b) => {
            return b.time.getTime() - a.time.getTime();
        });
        for (const comment of comments) {
            await db.collection('userList').findOne({_id: monk.id(comment.userID)}).then((user) => {
                file += `
                  <div class="comment">
                    <img src=${user.icon} alt="avatar" class="avatar">
                    <p class="name"> ${user.name} </p>
                    <div>
                      <p class="time comment-time"> ${comment.time.toLocaleString()}</p>
                      <p class="comment-text">${comment.comment} </p>
                    </div>
                  </div>
                `;
            });
        }
        if (req.cookies.userID) {
            file += `
            <div id="comment-input">
              <label for="text-input"></label>
              <input type="text" id="text-input">
              <button onclick="postComment()">post comment</button>
            </div>
            `;
        } else {
            file += `
            <div id="comment-input">
              <label for="text-input"></label>
              <input type="text" id="text-input" disabled>
              <button onclick="location.href='/login?newsID=${req.query.newsID}'">login to comment</button>
            </div>
            `;
        }

        file += `
        </body>
        </html>
        `
        res.send(file);
    });

});

app.post('/handlePostComment', function (req, res) {
    const db = req.db;
    const col = db.collection('newsList');
    const newsID = req.body.newsID;
    const cookies = cookieParaser.JSONCookies(req.cookies);
    let currentTime = req.body.currentTime;
    currentTime = new Date(currentTime).toLocaleString();

    let comment = {
        userID: monk.id(cookies.userID),
        time: new Date(currentTime),
        comment: req.body.input,
    };
    col.update({_id: monk.id(newsID)}, {$push: {'comments': comment}}, async (err) => {
        if (err) {
            res.send(err);
        }
        let newComments = [];
        await col.findOne({_id: monk.id(newsID)}).then((news) => {
            for (const comment of news.comments) {
                if (comment.time.getTime() > req.body.latestTime) {
                    newComments.push(comment);
                }
            }
        });
        newComments = newComments.sort((a, b) => {
            return b.time.getTime() - a.time.getTime();
        })
        let file = '';
        for (const comment of newComments) {
            await db.collection('userList').findOne({_id: monk.id(comment.userID)}).then((user) => {
                file += `
                  <div class="comment">
                    <img src="${user.icon}" alt="avatar" class="avatar">
                    <p class="name"> ${user.name} </p>
                    <div>
                      <p class="time comment-time"> ${comment.time.toLocaleString()}</p>
                      <p class="comment-text">${comment.comment} </p>
                    </div>
                  </div>
                `;
            });
        }
        res.send(file);
    });
});

app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/public/login.html');
});

app.get('/handleLogin', (req, res) => {
    const db = req.db;
    const col = db.collection('userList');
    col.findOne({'name': req.query.username}, (err, user) =>{
        console.log(`error = ${JSON.stringify(err)}, user = ${JSON.stringify(user)}`);
        console.log(req.query.password);
        if (err) {
            res.send(err);
        } else if (!user) {
            res.send('Username is incorrect');
        } else if (user.password !== req.query.password) {
            res.send('Password is incorrect');
        } else {
            res.cookie('userID', user._id);
            res.send('login success');
        }
    })
});

app.get('/handleLogout', (req, res) => {
    res.clearCookie('userID');
    res.end();
})

// launch the server with port 8081
const server = app.listen(8081, () => {
    const host = server.address().address;
    const port = server.address().port;
    console.log("listening at http://%s:%s", host, port)
});

