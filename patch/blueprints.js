const aws = require("aws-sdk");
aws.config.update({
    region: "eu-west-1"
});
const dynamodb = new aws.DynamoDB.DocumentClient();
const yaml = require("js-yaml");
const fs = require("fs");

let bps = yaml.load(fs.readFileSync("blueprints.yaml"));

let params = {
    RequestItems: {
        "eve-blueprints": []
    }
};

for(let bp in bps) {

    if(!bps.hasOwnProperty(bp)) {
        break;
    }

    params.RequestItems["eve-blueprints"].push({
        PutRequest: {
            Item: bps[bp]
        }
    });

    if(params.RequestItems["eve-blueprints"].length === 25) {
        dynamodb.batchWrite(params, function(err, data) {
            if(err) {
                console.log(err);
            }
        });
        params.RequestItems["eve-blueprints"] = [];
    }

}
