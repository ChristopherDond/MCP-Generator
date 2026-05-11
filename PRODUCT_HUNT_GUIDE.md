# Product Hunt Publishing Guide

## Step-by-Step: How to Publish mcp-gen on Product Hunt

### Prerequisites
- Product Hunt account (create at producthunt.com)
- Verified email
- Maker account or Admin account in workspace

### Step 1: Prepare Assets

#### Thumbnail Image (Required)
- Size: 440 × 440 pixels (square)
- Format: PNG or JPG
- Content: Logo or representative graphic
- Recommendation: Use MCP-Generator logo or CLI screenshot

#### Gallery Images (Optional but Recommended)
- Count: 4-5 images
- Aspect Ratio: 4:3 (1200 × 900px recommended)
- Content:
  1. Feature screenshot (CLI in action)
  2. TypeScript output example
  3. Python output example
  4. Integration with Claude Desktop
  5. Registry of APIs

#### Demo Video (Highly Recommended)
- Length: 30-60 seconds
- Format: MP4, WebM, or animated GIF
- Host: YouTube, Vimeo, or Loom
- Content: Show spec → generation → running MCP server
- Get link: Should be embeddable URL

### Step 2: Write Product Hunt Content

#### Tagline (max 60 characters)
```
Transform OpenAPI specs into MCP servers instantly
```

#### Headline (max 60 characters)  
```
Generate MCP servers from OpenAPI specs in seconds
```

#### Description (2-5 sentences, max 300 characters)
```
mcp-gen transforms OpenAPI specifications into production-ready 
Model Context Protocol servers in TypeScript or Python. 

Every API endpoint becomes a tool accessible to Claude and other LLMs. 
Supports OpenAPI v3 with oneOf/anyOf, integrates with 10+ public APIs, 
and regenerates safely without losing custom code.
```

#### Full Launching Information

**Headline:**
```
Transform any OpenAPI spec into an MCP server in seconds
```

**Tagline:**
```
Generate production-ready Model Context Protocol servers for Claude
```

**Description (main):**
```
mcp-gen is an open-source CLI tool that transforms OpenAPI v3 specifications 
into production-ready Model Context Protocol (MCP) servers.

What it does:
✨ Converts OpenAPI specs → MCP servers (TypeScript or Python)
🚀 Every endpoint becomes a tool accessible to Claude
🔄 Regenerate safely with incremental code preservation
📦 Built-in registry with 10+ pre-configured public APIs
🛡️ Type-safe with automatic TypeScript/Pydantic models
🐳 Comes with Dockerfile, CI/CD, and GitHub Actions

Use cases:
• Instantly give Claude access to any API
• Wrap internal APIs for LLM integration
• Rapid prototyping of AI-powered applications
• Automated MCP server generation with spec updates

Built with: TypeScript, Handlebars templating, OpenAPI parser, MCP SDK

Ready to deploy: Docker, npm registry, Python ecosystem
```

### Step 3: Prepare Maker Comments

Product Hunt allows the maker to post comments/GIFs explaining the product. 
Prepare 2-3 insightful comments:

**Comment 1: "How it works"**
```
Here's the workflow:

1️⃣ Start with an OpenAPI v3 spec (JSON or YAML)
2️⃣ Run: mcp-gen generate -i api.yaml -l typescript
3️⃣ Get a complete MCP server in your output folder
4️⃣ Deploy with Docker or run locally
5️⃣ Claude immediately gets access to all API endpoints

The generator handles:
• Type-safe parameters & responses
• Complex schemas (oneOf, anyOf, discriminators)
• Incremental regeneration (code survives updates)
• Multiple languages (TypeScript & Python)

We built this to solve: "Why does adding a new API to Claude take hours?"
```

**Comment 2: "What's included"**
```
Every generated server includes:

📁 Project structure:
- server.ts/server.py (MCP server with tool definitions)
- models.ts/models.py (generated type definitions)
- Dockerfile (ready to deploy)
- package.json/requirements.txt
- GitHub Actions CI/CD workflow
- README with setup instructions

🔧 Default implementations use API examples from the spec, 
ready to replace with real logic.

🆕 New to MCP? Check out:
https://modelcontextprotocol.io
```

**Comment 3: "Try it now"**
```
Get started in 3 minutes:

```bash
npm install -g mcp-gen
mcp-gen init --from petstore --generate -o ./my-server
cd my-server && npm start
```

Or use the registry:
- Stripe, GitHub, Slack, OpenAI, Twilio, Shopify, Kubernetes, etc.

Questions? Drop them below! 👇
```

### Step 4: Configure Product Hunt Listing

Navigate to producthunt.com/dashboard

1. **Click "Launch something new"**
2. **Fill in details:**
   - Title: See above
   - Tagline: See above
   - URL: https://github.com/ChristopherDond/MCP-Generator
   - Thumbnail: Upload image
   - Gallery: Upload 4-5 images
   - Video: Paste embedded URL
   - Description: See above

3. **Add categorization:**
   - Category: Developer Tools, Productivity
   - Tags: 
     * mcp
     * openapi
     * ai
     * developer-tools
     * cli
     * typescript
     * python
     * claude

4. **Set maker profile:**
   - Name: Christopher Dond (or team)
   - Bio: Brief description
   - Avatar: Professional photo

5. **Review & Schedule:**
   - Set launch time: Next Tuesday 12:01 AM PT (optimal)
   - Or set "Launch Today" for immediate publish

### Step 5: Pre-Launch (12 hours before)

- [ ] Test all links
- [ ] Verify video plays
- [ ] Review thumbnail/gallery once more
- [ ] Prepare backup images/video
- [ ] Draft Twitter announcement
- [ ] Alert community channels (GitHub Discussions, etc.)

### Step 6: Launch!

- [ ] Click "Publish" at 12:01 AM PT
- [ ] Monitor metrics (upvotes, comments)
- [ ] Respond to comments within 30 min
- [ ] Post maker comment with demo/explanation
- [ ] Share on Twitter with direct Product Hunt link
- [ ] Monitor for first 24 hours

### Step 7: Post-Launch Engagement (48+ hours)

- [ ] Reply to all comments (goal: 100% response rate in first 24h)
- [ ] Address feedback/questions
- [ ] Share lessons learned on social media
- [ ] Compile feedback for RC.2 improvements
- [ ] Post Dev.to article with Product Hunt discussion link

---

## Sample Tweet for Launch

```
🚀 Launching mcp-gen on Product Hunt TODAY!

Transform any OpenAPI spec into an MCP server for Claude.

TypeScript or Python. Ready to deploy. No boilerplate.

Give Claude access to any API in seconds.

🔗 https://producthunt.com/posts/...

#MCP #OpenAPI #AI #BuildInPublic
```

---

## Product Hunt Tips

✅ **Do:**
- Respond to comments quickly and helpfully
- Post multiple maker updates (GIFs, videos, etc.)
- Engage with other launches in your category
- Thank early supporters
- Answer questions thoroughly
- Show respect to feedback

❌ **Don't:**
- Ignore negative comments or questions
- Post spam or repetitive content
- Discount the product heavily (discounts aren't allowed anyway)
- Launch another competing product same day
- Use fake reviews or upvote manipulation

---

## Post-Hunt Analysis

After launch, analyze:

1. **Metrics:**
   - Peak upvote count
   - Final ranking
   - Total comments
   - Traffic to GitHub

2. **Feedback themes:**
   - Feature requests
   - Bug reports
   - Use case variations
   - Competitor comparisons

3. **Impact:**
   - GitHub stars gained
   - npm downloads
   - Community size growth

---

## Resources

- Product Hunt Creator Guide: https://www.producthunt.com/creator-guide
- MCP Documentation: https://modelcontextprotocol.io
- OpenAPI Spec: https://spec.openapis.org/oas/v3.0.0
