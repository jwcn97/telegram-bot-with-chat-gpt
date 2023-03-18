# clear contents in .env file
truncate -s 0 .env
# get secret keys from AWS
aws secretsmanager get-secret-value --secret-id TELEBOT | jq -r .SecretString | \
# populate .env with content
jq -r 'to_entries|map("\(.key)=\(.value|tostring)")|.[]' >> .env
