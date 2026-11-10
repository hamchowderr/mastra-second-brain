# How This Knowledge Base Works

Every markdown file in this folder becomes one Knowledge page when you run
`npm run knowledge:sync`. Folders become parent pages, so `clients/acme.md` is
the page `clients/acme`. The first `# heading` is the page name.

Edit a file and sync again to update its page. Delete a file and sync again to
remove its page. Pages the agent writes itself live alongside these and are not
touched by the sync.
