'use strict';

async function loadPage() {
    loadNewsList(1);
}


function refreshLoginOutButton(loginStatus) {
    const ele = document.getElementById('login-out');
    if (ele != null) {
        document.getElementById('header').removeChild(ele);
    }
    let button = document.createElement('button');
    if (loginStatus === 0) {
        button.setAttribute('onclick', `location.href='/login?newsID=0'`);
        button.innerHTML = "login"
    } else {
        button.setAttribute('onclick', 'logout()');
        button.innerHTML = 'logout';
    }
    button.setAttribute('id', 'login-out');
    button.setAttribute('class', 'center');
    document.getElementById('header').appendChild(button);
}

function loadNewsList(pageindex) {
    const xml = new XMLHttpRequest();
    xml.onreadystatechange = function () {
        if (xml.readyState === 4 && xml.status === 200) {
            const response = JSON.parse(xml.responseText);

            refreshLoginOutButton(response.loginStatue);

            let text = '';
            for (let doc of response.docs) {
                const date = new Date(doc.time);
                text += `
                <div class="news-section">
                  <a href="/displayNewsEntry?newsID=${doc.newsID}" class="news-title">${doc.headline} </a>
                  <p class="time">${date.toLocaleString()}</p>
                  <p>${doc['simplified-content']}</p>
                </div>
                `;
            }
            document.getElementById('news').innerHTML = text;

            let indices = '';
            for (let i = 1; i <= response.numberOfPages; ++i) {
                if (i === pageindex) {
                    indices += `
                        <span id="current-index" class="index" onclick="loadNewsList(${i})">
                          ${i}
                        </span> 
                    `
                } else {
                    indices += `
                        <span class="index" onclick="loadNewsList(${i})">
                          ${i}
                        </span> 
                    `
                }
            }
            document.getElementById('pageindex').innerHTML = indices;
        }
    }

    const s = document.getElementById('text-input');
    const requestObject = {
        searchString: s.value,
        index: pageindex,
    };
    xml.open('POST', 'retrievenewslist', true);
    xml.setRequestHeader("Content-type", "application/json");
    xml.send(JSON.stringify(requestObject));
}

function search() {
    event.preventDefault();
    loadNewsList(1);
}

function postComment() {
    const input = document.getElementById('text-input').value;
    if (input === "") {
        alert("No comment has been entered");
        return;
    }

    const comments = document.getElementsByClassName('comment-time');
    let latestTime = 0;
    if (comments.length !== 0) {
        const timeString = comments[0].innerHTML;
        latestTime = Date.parse(timeString);
    }
    const xml = new XMLHttpRequest();
    xml.onreadystatechange = function () {
        if (xml.readyState === 4 && xml.status === 200) {
            const text = xml.responseText;
            const ele = document.getElementById('comments');
            ele.innerHTML = text + ele.innerHTML;
        }
    }
    xml.open("POST", 'handlePostComment', true);
    xml.setRequestHeader("Content-type", "application/json");
    xml.send(JSON.stringify({
        input: input,
        latestTime: latestTime,
        currentTime: Date.now(),
        newsID: new URLSearchParams(window.location.search.substring(1)).get('newsID')
    }))

}

function loadLogin() {
    const search = window.location.search;
    const params = new URLSearchParams(search.substring(1));
    const newsID = params.get('newsID');
    const goBack = document.getElementById('go-back');
    if (newsID === "0") {
        goBack.setAttribute('href', '/');
    } else {
        goBack.setAttribute('href', `/displayNewsEntry?newsID=${newsID}`);
    }
}

function login() {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    if (username === '' || password === '') {
        alert('Please enter username and password');
        return;
    }
    const xml = new XMLHttpRequest();
    xml.onreadystatechange = function () {
        if (xml.readyState === 4 && xml.status === 200) {
            const response = xml.responseText;
            const headline = document.getElementById('headline');
            if (response === 'login success') {
                headline.innerHTML = 'You have successfully logged in';
                const form = document.getElementById('login-form');
                while (form.childNodes.length !== 2) {
                    form.removeChild(form.firstChild);
                }
            } else {
                headline.innerHTML = response;
            }
        }
    }
    xml.open('GET', `handleLogin?username=${username}&password=${password}`, true);
    xml.send();
}

function logout() {
    const xml = new XMLHttpRequest();
    xml.onreadystatechange = function () {
        if (xml.readyState === 4 && xml.status === 200) {
            refreshLoginOutButton(0);
        }
    }
    xml.open('GET', 'handleLogout', true);
    xml.send();
}