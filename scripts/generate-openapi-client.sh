#!/bin/sh

host=https://kusrnwijckyfvnkqdurl.supabase.co
apikey='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1c3Jud2lqY2t5ZnZua3FkdXJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTYxMzY1MTcsImV4cCI6MjAzMTcxMjUxN30.kZLvOeFpOUhAdYTlFzzGlFyZ_YsIydzhL528iTYq27Q'

mkdir -p ./schema ./source/database

curl --fail $host/rest/v1/?apikey=$apikey | jq . > ./schema/openapi.json

#npx @aleclarson/swagger-typescript-api --ky -p ./schema/openapi.json -o ./source/database/

npx supabase gen types typescript --project-id "kusrnwijckyfvnkqdurl" --schema public > ./source/database/supabase-types.ts
