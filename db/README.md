# Database

Put the Neon/Postgres migration `0001_init.sql` (the schema from the previous step of our conversation) in this folder. It is not wired to the site yet: the current build reads courses straight from the YAML files. The next milestone is a sync script that upserts those files into Postgres and fetches YouTube metadata.
