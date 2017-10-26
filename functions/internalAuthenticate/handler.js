'use strict';

const waterfall = require("async/waterfall");
const AWS = require("aws-sdk");
const https = require("https");

exports.handler = (event, context, callback) => {

    waterfall([
        (cb) => {
            checkInput(event, cb);
        },
        (characterId, key, cb) => {
            getToken(characterId, key, cb);
        },
        (tokenData, key, cb) => {
            validateTokenData(tokenData, key, cb);
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

    let splitCode = event.queryStringParameters.code.split(":");

    if(splitCode.length !== 2) {
        console.log("Incorrect parameter: code not splittable");
        return callback({
            "statusCode": 400,
            "body": "IncorrectParameter:code"
        });
    }

    if(!Number.isInteger(Number(splitCode[0]))) {
        console.log("Incorrect parameter: code not integer");
        return callback({
            "statusCode": 400,
            "body": "IncorrectParameter:code"
        });
    }

    return callback(null, splitCode[0], splitCode[1]);
}



function getToken(characterId, key, callback) {

    let db = new AWS.DynamoDB.DocumentClient();

    let params = {
        TableName: process.env.TokensTable,
        Key: {
            characterId: Number(characterId)
        }
    };

    db.get(params, (err, data) => {
       if(err) {
           console.log("storeToken db put error: " ,err);
           console.log("Params: ", params);
           return callback({
              "statusCode": 500,
               "body": "ServerError"
           });
       } else {
           return callback(null, data, key);
       }
    });
}

function validateTokenData(tokenData, key, callback) {
    if(tokenData["Item"]["key"] !== key) {
        console.log("Incorrect parameter: keys not matching: ", key, tokenData);
        return callback({
            "statusCode": 400,
            "body": "IncorrectParameter:code"
        });
    }

    if(tokenData["Item"]["expiry"] < new Date().getTime()) {
        return waterfall([
            (cb) => {
                refreshToken(tokenData, cb);
            },
            (refreshTokenData, callback) => {
                storeToken(refreshTokenData, key, tokenData["Item"]["characterId"], callback);
            }
        ], (err, data) => {
            if(err) {
                console.log("Failed refresh flow: ", err);
                return({
                    "statusCode": 500,
                    "body": "ServerError"
                });
            } else {
                return callback(null, data);
            }
        });
    }

    return callback(null, tokenData["Item"]["accessToken"]);
}

function refreshToken(tokenData, callback) {

    let base64code = new Buffer(process.env.CCPclientId + ":" + process.env.CCPsecretKey).toString('base64');

    let options = {
        hostname: "login.eveonline.com",
        method: "POST",
        path: "/oauth/token?grant_type=refresh_token&refresh_token=" + tokenData["Item"]["refreshToken"],
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

function storeToken(refreshTokenData, key, characterId, callback) {

    let db = new AWS.DynamoDB.DocumentClient();

    let params = {
        TableName: process.env.TokensTable,
        Item: {
            characterId: characterId,
            key: key,
            accessToken: refreshTokenData["access_token"],
            refreshToken: refreshTokenData["refresh_token"],
            expiry: refreshTokenData["expires_in"] * 1000 + new Date().getTime()
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
            return callback(null, refreshTokenData["access_token"]);
        }
    });

}
