const express = require('express');
var https = require('https');
var fs = require('fs');
const { Octokit } = require('octokit');
var shell = require('shelljs');



const init = async (req, res) => {
	 const octokit = new Octokit({
      auth: '',
    });
    await octokit.request('GET /repos/Aravindhsiva/asyncapi/contents/', {
      owner: 'Aravindhsiva',
      repo: 'asyncapi',
      path:'/',
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }).then(({data})=>{
      data.map(({download_url, name})=>{
        console.log(download_url);
          download(download_url, "files/"+name, ()=>{
              shell.exec("echo Downloaded : " + name)
          });
      });
    });
};


init();


var download = function (url, dest, cb) {
    var file = fs.createWriteStream(dest);
    https.get(url, function (response) {
        response.pipe(file);
        file.on('finish', function () {
            file.close(cb);
        });
    }).on('error', function (err) {
        fs.unlink(dest);
        if (cb) cb(err.message);
    });
};

