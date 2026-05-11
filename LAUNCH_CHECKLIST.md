# 🚀 Launch Checklist - MCP-Generator v2.0.0

## Phase 1: Pre-Launch (2-3 days before)

- [ ] **Roadmap Update**
  - [x] Mark "Week 6" as in-progress
  - [ ] Update README.md/README.pt-BR.md with RC status
  - [ ] Add version badge

- [ ] **Documentation**
  - [ ] Verify all links in README work
  - [ ] Update CONTRIBUTING.md if needed
  - [ ] Create CHANGELOG.md with v1.0.0-rc.1 highlights
  - [ ] Review and update SECURITY.md

- [ ] **Code Readiness**
  - [ ] Run full test suite locally
  - [ ] Verify builds for both TypeScript and Python targets
  - [ ] Test CLI interactively with examples (Petstore, etc.)
  - [ ] Check bundle size
  - [ ] Run security audit: `npm audit`

- [ ] **Content Preparation**
  - [ ] Prepare 3-5 screenshots showing:
    - [ ] CLI in action (generate command)
    - [ ] TypeScript generated project structure
    - [ ] Python generated project structure
    - [ ] MCP server integration with Claude Desktop
    - [ ] Registry of available APIs
  - [ ] Create demo video (30-60 seconds):
    - [ ] Record screen showing spec → generation → running server
    - [ ] Add captions/text overlays
    - [ ] Upload to YouTube (unlisted) or Vimeo
  - [ ] Write social media content (see PRODUCT_HUNT.md)
  - [ ] Draft Dev.to article (title, outline)

- [ ] **Configuration**
  - [ ] Add NPM_TOKEN to GitHub secrets (if not already present)
  - [ ] Verify GitHub Actions workflow will work
  - [ ] Test release workflow locally (dry-run)

---

## Phase 2: Release Day (24h before Product Hunt)

### GitHub Release
- [ ] Run release script: `npm run release:rc`
  - [ ] Bumps version to 1.0.0-rc.1
  - [ ] Runs tests & build
  - [ ] Creates Git tag
  - [ ] Pushes to GitHub
  - [ ] Monitors GitHub Actions publish to npm

- [ ] Verify GitHub Release created:
  - [ ] Check tag exists: https://github.com/ChristopherDond/MCP-Generator/releases/tag/v1.0.0-rc.1
  - [ ] Release notes auto-generated
  - [ ] Links working

### npm Publication
- [ ] Verify npm publish succeeded with tag `rc`:
  ```bash
  npm view mcp-gen versions
  npm info mcp-gen@1.0.0-rc.1
  ```
- [ ] Test installation: `npm install mcp-gen@rc`
- [ ] Verify CLI works: `mcp-gen --version` (should show 1.0.0-rc.1)

### Documentation Updates
- [ ] Update README.md: Add "Release Candidate" badge
- [ ] Update README.pt-BR.md: Update Roadmap with ✅ status
- [ ] Commit & push docs update
- [ ] Update GitHub "About" section with RC version
- [ ] Pin Release announcement to Discussions

---

## Phase 3: Product Hunt Launch (Launch Day)

### Pre-Launch (12 hours before)
- [ ] Schedule tweet for 12:01 AM PT
- [ ] Schedule Dev.to article post if ready
- [ ] Prepare response templates for common questions
- [ ] Set up Product Hunt notifications/alerts on phone

### T-0 (12:01 AM PT)
- [ ] Submit to Product Hunt:
  - [ ] Headline: "Transform any OpenAPI spec into an MCP server in seconds"
  - [ ] Tagline: "Convert APIs to Model Context Protocol servers for Claude"
  - [ ] Description: (from PRODUCT_HUNT.md)
  - [ ] Upload thumbnail/gallery (4:3 aspect ratio, 1200x900px)
  - [ ] Add demo video link
  - [ ] Link to GitHub
  - [ ] Add 4-5 tags: #mcp #openapi #ai #claude #developer-tools

- [ ] Publish prepared content:
  - [ ] Tweet/post on Twitter
  - [ ] Share in relevant Discord/Slack communities (Anthropic, MCP community)
  - [ ] Post on HackerNews (manually, if appropriate)
  - [ ] Post on r/webdev, r/rust, r/typescript (if applicable)

### T+1 hour
- [ ] Check Product Hunt page:
  - [ ] Metrics visible (upvotes, comments, trending rank)
  - [ ] Video plays correctly
  - [ ] Links work
  
- [ ] Engage:
  - [ ] Respond to first comments
  - [ ] Answer questions in comments
  - [ ] Thank early supporters
  - [ ] Fix any reported issues/typos

### T+2-6 hours
- [ ] Monitor:
  - [ ] Product Hunt upvote count
  - [ ] Top comments
  - [ ] Common questions/feedback
  - [ ] Trending position

- [ ] Continue engagement:
  - [ ] Respond to all comments within 2 hours
  - [ ] Provide helpful answers
  - [ ] Offer early user bounties for bug reports

---

## Phase 4: Post-Launch (24-72 hours)

### Day 1 (Launch Day)
- [ ] Check end-of-day metrics
- [ ] Compile feedback/feature requests
- [ ] Fix any critical bugs reported
- [ ] Prepare Day 2 content

### Day 2 (T+24h)
- [ ] Post Dev.to article
- [ ] Publish Twitter thread (longer form)
- [ ] Send follow-up to Product Hunt
- [ ] Check GitHub stars/forks
- [ ] Analyze feedback for prioritization

### Day 3 (T+48h)
- [ ] Compile feedback into issues/PRs
- [ ] Plan incremental improvements
- [ ] Create RC.2 if needed based on feedback
- [ ] Start collecting testimonials

---

## Success Metrics

Targets for v1.0.0-rc.1:

| Metric | Target | Actual |
|--------|--------|--------|
| Product Hunt Upvotes (24h) | 400+ | ___ |
| Product Hunt Rank | Top 10 | ___ |
| GitHub Stars | 200+ | ___ |
| npm Installs (week 1) | 500+ | ___ |
| Product Hunt Comments | 50+ | ___ |
| Twitter Impressions | 10k+ | ___ |

---

## Communication Templates

### Product Hunt Comment Response (Feature Request)
```
Great suggestion! This is something we've heard interest in. 

For RC.2, we're prioritizing [specific area]. Once we stabilize there, 
we'll look into [feature]. Would love to see your use case in a GitHub issue!
```

### Product Hunt Comment Response (Bug Report)
```
Thanks for reporting! We'll investigate and have a fix in RC.2 next week. 
Could you open an issue on GitHub with reproduction steps?
```

### Twitter Reply (Feature Idea)
```
Love this idea! Opening a GitHub issue now. Would be great to discuss 
the design with the community. Please star & comment!
```

---

## Post-RC Planning

After RC.1 feedback:

- [ ] Compile feedback into GitHub issues
- [ ] Prioritize for RC.2 (1-2 weeks)
- [ ] Identify blockers for v1.0.0 final
- [ ] Plan v1.0.0 release (2-4 weeks out)
- [ ] Consider guest posts / interviews

---

## Rollback Plan

If critical issues found:

1. Remove from Product Hunt (if possible)
2. Create RC.2 immediately with hotfixes
3. Relaunch after testing

---

## Notes

- Keep energy high throughout launch day
- Be responsive to community
- Celebrate early wins with team
- Document lessons learned
- Plan for sustained momentum post-launch
