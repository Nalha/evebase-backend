const aws = require("aws-sdk");
aws.config.update({
    region: "eu-west-1"
});
const dynamodb = new aws.DynamoDB.DocumentClient();
const yaml = require("js-yaml");
const fs = require("fs");

let items = yaml.load(fs.readFileSync("./sde/fsd/typeIDs.yaml"));
let itemArray = [];

let itemLength = 0;
for(let item in items) {
    if(!items.hasOwnProperty(item)) {
        continue;
    }

    itemLength++;

    let tempBp = items[item];
    tempBp.typeID = Number(item);
    itemArray.push(tempBp);
}

pushBatch(itemArray);


function pushBatch(array) {

    let arrayBatch = [];

    for(let i = 0; i < 25 && i < array.length; i++) {
        arrayBatch.push(array[i]);
    }
    array.splice(0, Math.min(25, array.length));

    let params = {
        RequestItems: {
            "eve-typeIDs": []
        }
    };

    for(let item of arrayBatch) {
        params.RequestItems["eve-typeIDs"].push({
            PutRequest: {
                Item: item
            }
        });
    }

    dynamodb.batchWrite(params, function(err) {
        if(err) {
            console.log(err);
            console.log(params);
        } else {
            console.log(array.length);
            if(array.length > 0) {
                pushBatch(array);
            } else {
                console.log("Done!");
            }
        }
    });
    params.RequestItems["eve-typeIDs"] = [];
}