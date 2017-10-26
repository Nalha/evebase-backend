
PACKAGE
aws cloudformation package --template-file cloudformation\cloudformation.yml --s3-bucket YOUR-S3-BUCKET --output-template-file dist\cf.yml

DEPLOY
aws cloudformation deploy --template-file dist\cf.yml --stack-name evebase-beta --parameter-overrides Stage=beta CCPclientId=XXXXXX CCPsecretKey=XXXXXXX --capabilities CAPABILITY_IAM