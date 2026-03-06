import requests, os, re, time, json

# --- GLOBAL CONFIGURATION ---
API_BASE = "https://www.eporner.com/api/v2/video/search/"
QUERIES = ["top", "trending", "latest", "hd"]  # Mga kategorya na kukunin natin
PAGES_PER_QUERY = 2  # Ilang pages per query (e.g., 2 pages x 30 videos = 60 per query)

# [MULTI-CLUSTER PBN CONFIGURATION]
# Palitan ang mga ito ng mga totoong domain at server paths mo
TARGETS = [
    {
        "domain": "https://lusthub.com",
        "path": ".",  # Pinalitan ko pansamantala para ma-test mo sa computer mo
        "authority_url": "https://lusthub.com",  # Ang King / Money Site
    },
    {
        "domain": "https://lusthub-support.com",
        "path": "/watch",
        "authority_url": "https://lusthub.com",  # Nagpapasa ng SEO juice sa King
    },
]

# Database buffer para sa search
CURRENT_INDEX_DB = []


# --- HELPER FUNCTIONS ---
def slugify(text, item_id=""):
    text = str(text).lower()
    # Tanggalin ang mga special characters
    slug = re.sub(r"[^a-z0-9]+", "-", text).strip("-")

    # PUTULIN ANG HABA: 50 characters maximum lang para sa title
    slug = slug[:50].strip("-")

    # Kung walang natirang text, gamitin ang salitang 'video'
    if not slug:
        slug = "video"

    # Laging idugtong ang item_id sa dulo para siguradong unique ang filename
    return f"{slug}-{item_id}"


def safe_str(text):
    return str(text).replace("'", "\\'").replace('"', '\\"')


def generate_json_ld(video, url):
    """Bumubuo ng Schema.org para sa Adult Content para ma-index ng search engines"""
    schema = {
        "@context": "https://schema.org",
        "@type": "AdultVideo",
        "name": video.get("title", "Untitled"),
        "description": f"Watch {video.get('title')} on our premium tube.",
        "thumbnailUrl": video.get("default_thumb", {}).get("src", ""),
        "uploadDate": video.get("added", time.strftime("%Y-%m-%dT%H:%M:%S")),
        "duration": f"PT{video.get('length_min', '00:00').replace(':', 'M')}S",
        "url": url,
    }
    return json.dumps(schema)


def generate_sitemaps(target_path, site_domain):
    print(f"    🗺️  Generating sitemap.xml...")
    xml_content = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

    videos_path = os.path.join(target_path, "watch")
    if os.path.exists(videos_path):
        for filename in os.listdir(videos_path):
            if filename.endswith(".html"):
                file_path = os.path.join(videos_path, filename)
                mod_time = time.strftime(
                    "%Y-%m-%d", time.gmtime(os.path.getmtime(file_path))
                )
                xml_content += f"  <url>\n    <loc>{site_domain}/watch/{filename}</loc>\n    <lastmod>{mod_time}</lastmod>\n    <changefreq>monthly</changefreq>\n  </url>\n"

    xml_content += "</urlset>"
    with open(os.path.join(target_path, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write(xml_content)


def generate_robots_txt(target_path, site_domain):
    print("    🤖 Generating robots.txt...")
    content = f"User-agent: *\nAllow: /\nSitemap: {site_domain}/sitemap.xml\n"
    with open(os.path.join(target_path, "robots.txt"), "w", encoding="utf-8") as f:
        f.write(content)


# --- CORE LOGIC ---
def fetch_content_from_eporner():
    content_list = []
    seen_ids = set()
    print("📡 Kumokonekta sa Eporner API...")

    for query in QUERIES:
        for page in range(1, PAGES_PER_QUERY + 1):
            try:
                url = f"{API_BASE}?query={query}&per_page=30&page={page}&format=json&thumb_size=big"
                response = requests.get(url).json()
                for video in response.get("videos", []):
                    if video["id"] not in seen_ids:
                        seen_ids.add(video["id"])
                        content_list.append(video)
            except Exception as e:
                print(f"  ❌ Error fetching '{query}' page {page}: {e}")

    print(f"✅ Nakakuha ng {len(content_list)} unique videos.")
    return content_list


def process_targets(all_videos):
    try:
        with open("template.html", "r", encoding="utf-8") as f:
            TEMPLATE = f.read()
    except FileNotFoundError:
        print("❌ CRITICAL ERROR: Wala ang template.html sa folder na ito!")
        return

    for target in TARGETS:
        domain = target["domain"]
        root_path = target["path"]
        authority_url = target["authority_url"]

        print(f"\n🚀 Processing Target: {domain}")
        os.makedirs(os.path.join(root_path, "watch"), exist_ok=True)

        new_files_count = 0
        global CURRENT_INDEX_DB
        CURRENT_INDEX_DB = []

        for video in all_videos:
            title = video.get("title", "Untitled")
            v_id = video.get("id")
            slug = slugify(title, v_id)

            output_filename = f"{slug}.html"
            output_path = os.path.join(root_path, "watch", output_filename)

            page_url = f"{domain}/watch/{slug}.html"
            canonical_url = f"{authority_url}/watch/{slug}.html"

            # I-save sa search index natin
            CURRENT_INDEX_DB.append(
                {
                    "id": v_id,
                    "title": title,
                    "slug": slug,
                    "thumb": video.get("default_thumb", {}).get("src"),
                }
            )

            if os.path.exists(output_path):
                continue

            try:
                # Format Data
                duration = video.get("length_min", "00:00")
                views = video.get("views", 0)
                formatted_views = (
                    f"{views/1000000:.1f}M"
                    if views > 1000000
                    else f"{views/1000:.1f}K" if views > 1000 else str(views)
                )
                embed_code = f'<iframe src="https://www.eporner.com/embed/{v_id}/" frameborder="0" width="100%" height="100%" allowfullscreen scrolling="no"></iframe>'

                keywords = video.get("keywords", "").split(",")[:10]
                tags_html = "".join(
                    [
                        f'<span class="tag-pill">{k.strip()}</span>'
                        for k in keywords
                        if k.strip()
                    ]
                )

                seo_desc = f"Watch {safe_str(title)} in HD. Free streaming on {domain.replace('https://', '')}."

                # I-inject ang data sa Template
                html_content = (
                    TEMPLATE.replace("{{TITLE}}", safe_str(title))
                    .replace("{{SEO_DESCRIPTION}}", seo_desc)
                    .replace("{{CANONICAL}}", canonical_url)
                    .replace("{{EMBED_CODE}}", embed_code)
                    .replace("{{VIEWS}}", formatted_views)
                    .replace("{{DURATION}}", duration)
                    .replace("{{TAGS}}", tags_html)
                    .replace("{{SCHEMA}}", generate_json_ld(video, page_url))
                )

                with open(output_path, "w", encoding="utf-8") as f:
                    f.write(html_content)
                new_files_count += 1

            except Exception as e:
                print(f"    ❌ Error sa video {v_id}: {e}")

        print(f"   ✅ Finished. New files generated: {new_files_count}")
        generate_sitemaps(root_path, domain)
        generate_robots_txt(root_path, domain)

        # Save Search Index JSON
        with open(
            os.path.join(root_path, "search_index.json"), "w", encoding="utf-8"
        ) as f:
            json.dump(CURRENT_INDEX_DB, f)


if __name__ == "__main__":
    print("🎬 Starting LustHub PBN Generator...")
    start_time = time.time()
    videos_data = fetch_content_from_eporner()
    if videos_data:
        process_targets(videos_data)
    else:
        print("❌ Walang nakuha sa API. Aborting.")
    print(f"\n🎉 All tasks completed in {round(time.time() - start_time, 2)} seconds.")
