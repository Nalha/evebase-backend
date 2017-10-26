'use strict';

const waterfall = require("async/waterfall");
const AWS = require("aws-sdk");
const https = require("https");
const UUID = require("uuid");

exports.handler = (event, context, callback) => {

    waterfall([
        (cb) => {
            checkInput(event, cb);
        },
        (cb) => {
            getToken(event, cb);
        },
        (tokenData, cb) => {
            getCharacterId(tokenData, cb);
        },
        (characterData, tokenData, cb) => {
            storeToken(characterData, tokenData, cb);
        }
    ], (err, data) => {
        if(err) {
            return callback(null, err);
        } else {
            return callback(null, {
                "statusCode": 200,
                "headers": {
                    "Access-Control-Allow-Origin": "*"
                },
                "body": JSON.stringify(data)
            });
        }
    });

};

function checkInput(event, callback) {

    if(!event.queryStringParameters) {
        console.log("Missing parameters");
        return callback({
            "statusCode": 400,
            "body": "MissingParameter:all"
        });
    }

    if(!event.queryStringParameters.code) {
        console.log("Missing parameter: code");
        return callback({
            "statusCode": 400,
            "body": "MissingParameter:code"
        });
    }

    return callback(null);
}

function getToken(event, callback) {

    let base64code = new Buffer(process.env.CCPclientId + ":" + process.env.CCPsecretKey).toString('base64');

    let options = {
        hostname: "login.eveonline.com",
        method: "POST",
        path: "/oauth/token?grant_type=authorization_code&code=" + event.queryStringParameters.code,
        headers: {
            "Authorization": "Basic " + base64code,
            "Content-Type": "application/x-www-form-urlencoded"
        }
    };

    let req = https.request(options, (res) => {
        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => rawData += chunk);
        res.on('end', () => {
            let parsedData;
            try {
                parsedData = JSON.parse(rawData);
            } catch (e) {
                console.log("getToken https request error: ", e);
                return callback({
                    "statusCode": 500,
                    "body": "ServerError"
                });
            }

            if(!parsedData["access_token"] || !parsedData["refresh_token"]) {
                console.log("getToken error: incorrect code");
                return callback({
                    "statusCode": 500,
                    "body": "ServerError"
                });
            }

            return callback(null, parsedData);
        });
    });

    req.end();
}

function storeToken(characterData, tokenData, callback) {

    let db = new AWS.DynamoDB.DocumentClient();
    let uuid = UUID.v4();

    let params = {
        TableName: process.env.TokensTable,
        Item: {
            characterId: characterData["CharacterID"],
            key: uuid,
            accessToken: tokenData["access_token"],
            refreshToken: tokenData["refresh_token"],
            expiry: tokenData["expires_in"] * 1000 + new Date().getTime()
        }
    };

    db.put(params, (err) => {
       if(err) {
           console.log("storeToken db put error: " ,err);
           console.log("Params: ", params);
           return callback({
              "statusCode": 500,
               "body": "ServerError"
           });
       } else {
           return callback(null, characterData["CharacterID"] + ":" + uuid);
       }
    });

}

function getCharacterId(tokenData, callback) {

    let options = {
        hostname: "login.eveonline.com",
        method: "GET",
        path: "/oauth/verify",
        headers: {
            "Authorization": "Bearer " + tokenData["access_token"]
        }
    };

    let req = https.request(options, (res) => {
        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => rawData += chunk);
        res.on('end', () => {
            let characterData;
            try {
                characterData = JSON.parse(rawData);
            } catch (e) {
                console.log("getCharacterId https request error: ", e);
                console.log("Params: ", options);
                return callback({
                    "statusCode": 500,
                    "body": "ServerError"
                });
            }
            return callback(null, characterData, tokenData);
        });
    });

    req.end();
}
