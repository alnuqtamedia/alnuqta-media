# Own-article publisher capability

`profiles.own_article_publisher` is an administrative opt-in for an editor or
writer. It is read from the protected profile row, not user-editable JWT metadata.
Clients only have SELECT on profiles. Existing accounts default to false.

An opted-in account may edit, publish/unpublish, and delete its own articles.
Ownership means `author_id = auth.uid()` or `writer_id = auth.uid()`. A matching
display name, an editor assignment, or a media credit is insufficient. Restrictive
RLS intersects the pre-existing editor-wide UPDATE policy. A trigger freezes
author_id and writer_id for this account; it cannot claim another writer's article
or assign its own article away. New inserts must have the account as author and
may only assign itself as writer. Draft translation inserts/updates are similarly
restricted to its own parent articles.

The opted-in account can publish and maintain its own public articles using its
normal authenticated session. The source/category/image-credit checklist still
applies. Owner MFA requirements remain in force. This exception is account-scoped,
not a blanket grant to every editor. No existing article is published or deleted
when enabling the capability.

Deletion requires first unpublishing the article. ClickUp-linked rows are not
deletable through this capability, to prevent an automatic reimport. Existing
audit/version capture remains enabled and media files are not deleted.

The dashboard reads the capability on login/reload, lists this account's creator
or writer rows, and displays edit/publish/unpublish/delete controls accordingly.
It preserves ownership IDs when saving an existing record and rejects stale
publish/unpublish/delete operations using updated_at. Existing unflagged editor,
writer, and Owner behavior is preserved.

Verification includes:

- Node permission matrix for owner vs editor vs scoped editor and author/writer
  ownership, rejecting byline-only or editor-only assignments.
- A real browser test with a mocked API that exercises editing an existing public
  article, publishing, unpublishing, and deleting own fixtures; no production API
  writes or MFA redirects are performed by this test.
- `supabase/tests/own_article_publisher_scope.sql`: transaction-only database
  fixtures testing real RLS and publication triggers, foreign-row denial,
  ownership freezing, draft translation isolation, readiness, and Owner MFA.
  The entire fixture transaction is rolled back. Supply a verified editor UUID
  in `test.own_scope_subject` after BEGIN. Do not remove the final ROLLBACK.

Schema migration does not activate a particular account. Enable it only after
resolving the intended Auth user and confirming its profile role and ownership.
