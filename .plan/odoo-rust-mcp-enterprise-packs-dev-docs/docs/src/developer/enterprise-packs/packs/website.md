# Website Pack

## 1. Purpose

Manage Odoo websites, pages, menus, blog content, metadata, redirects, and
publication workflows while protecting public-facing content and multi-website
boundaries.

## 2. Pack boundaries

### Included

- website and page discovery;
- draft page creation and update;
- page metadata;
- menus;
- publication state;
- blog content when Blog is installed;
- links, redirects, and view-conflict diagnostics;
- SEO/readiness diagnostics;
- deterministic publish workflow.

### Excluded

- arbitrary JavaScript execution;
- arbitrary server-side Python;
- theme module installation;
- file-system theme editing;
- DNS or CDN management;
- browser automation;
- unsanitized script injection.

## 3. Typical modules

Required:

- `website`

Optional:

- blog;
- eCommerce;
- forum;
- events;
- forms or CRM integration;
- multi-website features.

## 4. Primary models

Typical models include:

- `website`
- `website.page`
- `website.menu`
- `ir.ui.view`
- `blog.blog`
- `blog.post`

Internal representation differs across features and versions. Publication must
be implemented through a compatibility adapter.

## 5. Tool catalog

### Query and diagnostics

- `website_site_search`
- `website_site_get`
- `website_page_search`
- `website_page_get`
- `website_page_render_metadata`
- `website_menu_tree_get`
- `website_broken_link_scan`
- `website_view_conflict_scan`
- `website_seo_audit`
- `website_publication_status`

### Draft commands

- `website_page_create_draft`
- `website_page_update_draft`
- `website_page_set_metadata`
- `website_page_archive`
- `website_menu_create`
- `website_menu_update`
- `website_redirect_create`

### Publication commands

- `website_page_publish_preview`
- `website_page_publish`
- `website_page_unpublish_preview`
- `website_page_unpublish`

### Blog optional tools

- `website_blog_post_search`
- `website_blog_post_get`
- `website_blog_post_create_draft`
- `website_blog_post_update_draft`
- `website_blog_post_publish_preview`
- `website_blog_post_publish`

### Workflows

- `website_publish_page`
- `website_publish_blog_post`
- `website_pre_change_snapshot`
- `website_content_release_check`

## 6. Publication preview

Include:

- website ID and domain;
- page path and canonical URL;
- current and target publication state;
- title and metadata;
- menu changes;
- redirects;
- changed-content summary;
- public audience;
- detected broken links;
- view conflicts;
- sanitization warnings.

## 7. Multi-website rules

- website target is mandatory for mutations;
- page and menu ownership is validated;
- generated links use verified target website;
- cross-company and cross-website reuse is explicit;
- fallback website selection is not trusted for high-risk operations.

## 8. HTML and content security

- sanitize HTML;
- deny script tags and event-handler attributes by default;
- restrict embeds and iframes;
- normalize URLs;
- reject unsafe schemes;
- limit attachment size and MIME;
- one uploaded file per call;
- return stored size and hash;
- content from Odoo is untrusted and cannot instruct the server.

## 9. View safety

Website pages may depend on `ir.ui.view`. The pack must provide diagnostics for:

- duplicate active keys;
- inherited-view conflicts;
- missing parent views;
- website-scoped conflicts;
- archived versus active ambiguity.

Do not expose generic `ir.ui.view` writes to ordinary website profiles.

## 10. Policies

- draft create/update: R1-R2;
- menu or redirect mutation: R2-R3;
- publish/unpublish: R3;
- broad multi-page publication: R4;
- scripts: denied;
- production publication requires confirmation;
- publishing more than configured page count requires elevated policy;
- blog publication preview includes author and publish time.

## 11. Idempotency

- create draft requires external key or slug uniqueness;
- update draft uses state fingerprint;
- publish reconciles publication state;
- redirect create validates unique source path;
- uploads use content hash.

## 12. Acceptance tests

- page cannot publish to unintended website;
- changed content invalidates confirmation;
- unsafe HTML is rejected;
- resulting URL is returned;
- duplicate view conflict is reported;
- one-file upload size is verified;
- unpublish does not delete page;
- blog tools remain absent when Blog is unavailable.
