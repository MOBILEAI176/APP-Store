import os
import re
import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, request, send_from_directory, send_file
from flask_cors import CORS
from google_play_scraper import app as gplay_app, search as gplay_search, reviews, Sort
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import lru_cache

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')
CORS(app)

PORT = int(os.environ.get('PORT', 5000))

def get_exact_apk_size(app_id: str):
    try:
        url = f"https://d.apkpure.com/b/APK/{app_id}?version=latest"
        res = requests.head(url, allow_redirects=True, timeout=3)
        content_length = res.headers.get('content-length')
        if content_length:
            bytes_val = int(content_length)
            if bytes_val > 1024 * 1024 * 1024:
                return f"{round(bytes_val / (1024 * 1024 * 1024), 1)} GB"
            return f"{round(bytes_val / (1024 * 1024), 1)} MB"
    except Exception as err:
        print(f"Exact size resolution failed for {app_id}:", err)
    return None

def format_app_summary(item):
    score = item.get('score')
    score_text = f"{score:.1f}" if score else '4.5'
    return {
        'id': item.get('appId'),
        'title': item.get('title'),
        'developer': item.get('developer'),
        'icon': item.get('icon'),
        'summary': item.get('summary') or item.get('description') or 'Available now',
        'scoreText': score_text,
        'free': item.get('free', True)
    }

@lru_cache(maxsize=250)
def cached_search(query: str, n_hits: int = 30):
    return gplay_search(query, n_hits=n_hits, lang='en', country='us')

@lru_cache(maxsize=300)
def cached_app_detail(app_id: str):
    return gplay_app(app_id, lang='en', country='us')

def fetch_150_plus_apps(query_list):
    all_apps = []
    seen_ids = set()

    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_query = {
            executor.submit(cached_search, q, 30): q for q in query_list
        }
        for future in as_completed(future_to_query):
            try:
                results = future.result()
                for item in results:
                    app_id = item.get('appId')
                    if app_id and app_id not in seen_ids:
                        seen_ids.add(app_id)
                        all_apps.append(format_app_summary(item))
            except Exception as err:
                print('Error in concurrent scrape job:', err)

    return all_apps

@app.route('/')
def serve_index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:filename>')
def serve_static_file(filename):
    file_path = os.path.join(BASE_DIR, filename)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_from_directory(BASE_DIR, filename)
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/api/user/profile', methods=['GET'])
def get_user_profile():
    return jsonify({
        'name': 'Demo User',
        'email': 'user@example.com',
        'avatar': 'https://ui-avatars.com/api/?name=Demo+User&background=0D8ABC&color=fff&size=150'
    })

@app.route('/api/trending', methods=['GET'])
def get_trending():
    queries = [
        'top free apps', 'viral popular apps', 'trending social apps', 
        'top action games', 'editors choice apps', 'best new utilities'
    ]
    apps = fetch_150_plus_apps(queries)
    return jsonify(apps)

@app.route('/api/apps', methods=['GET'])
def get_apps():
    category = request.args.get('category', 'ALL').upper()
    page = int(request.args.get('page', 1))
    per_page = 12
    
    query_map = {
        'ALL': ['top free apps', 'popular tools', 'trending apps'],
        'UTILITIES': ['best utilities', 'productivity tools'],
        'GAMES': ['top action games', 'casual games']
    }
    
    selected_queries = query_map.get(category, query_map['ALL'])
    all_results = fetch_150_plus_apps(selected_queries)
    
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page
    paginated_data = all_results[start_idx:end_idx]
    
    return jsonify({
        'page': page,
        'has_more': end_idx < len(all_results),
        'data': paginated_data
    })

@app.route('/api/category/<cat_name>', methods=['GET'])
def get_category_apps(cat_name):
    cat_clean = cat_name.lower()
    queries = [
        f'top {cat_clean} apps', 
        f'best {cat_clean} tools', 
        f'popular {cat_clean} applications',
        f'new {cat_clean} apps'
    ]
    apps = fetch_150_plus_apps(queries)
    return jsonify(apps)

@app.route('/api/search', methods=['GET'])
def search_apps():
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify([])
    try:
        related_queries = [query, f"{query} free", f"{query} app"]
        apps = fetch_150_plus_apps(related_queries)
        return jsonify(apps)
    except Exception as err:
        print('Search error:', err)
        return jsonify({'error': 'Search failed'}), 500

@app.route('/api/get-apk-url', methods=['GET'])
def get_apk_url():
    query = request.args.get('s', 'free fire').strip()
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}

    try:
        search_url = f"https://www.apkmirror.com/?post_type=app_release&searchtype=apk&s={query}&bundles%5B%5D=apkm_bundles&bundles%5B%5D=apk_files"
        search_res = requests.get(search_url, headers=headers)
        soup = BeautifulSoup(search_res.text, 'html.parser')

        first_title = soup.select_one('.appRow .title')
        if not first_title or not first_title.get('href'):
            return jsonify({'error': 'Release not found'}), 404

        release_url = f"https://www.apkmirror.com{first_title['href']}"
        release_res = requests.get(release_url, headers=headers)
        soup_release = BeautifulSoup(release_res.text, 'html.parser')

        download_btn = soup_release.select_one('a.downloadButton')
        if not download_btn or not download_btn.get('href'):
            return jsonify({'error': 'Download page not found'}), 404

        final_page_url = f"https://www.apkmirror.com{download_btn['href']}"
        final_res = requests.get(final_page_url, headers=headers)
        soup_final = BeautifulSoup(final_res.text, 'html.parser')

        direct_link = soup_final.select_one('a[rel="nofollow"][data-google-vignette="false"]')
        if direct_link and direct_link.get('href'):
            return jsonify({'apkUrl': f"https://www.apkmirror.com{direct_link['href']}"})

        return jsonify({'error': 'Direct link not found'}), 404

    except Exception as e:
        return jsonify({'error': 'Scraping failed', 'details': str(e)}), 500

@app.route('/api/app/<app_id>', methods=['GET'])
def get_app_detail(app_id):
    try:
        detail = cached_app_detail(app_id)
        
        revs, _ = reviews(
            app_id,
            lang='en',
            country='us',
            sort=Sort.MOST_RELEVANT,
            count=6
        )

        formatted_reviews = []
        for r in revs:
            formatted_reviews.append({
                'userName': r.get('userName', 'User'),
                'userImage': r.get('userImage') or 'https://ui-avatars.com/api/?name=User&background=333&color=fff',
                'score': r.get('score', 5),
                'content': r.get('content', ''),
                'date': str(r.get('at', ''))[:10]
            })

        developer_id = detail.get('developer')
        more_by_dev = []
        if developer_id:
            try:
                dev_results = cached_search(developer_id, n_hits=8)
                more_by_dev = [
                    format_app_summary(item) for item in dev_results 
                    if item.get('appId') != app_id
                ]
            except Exception as dev_err:
                print('Developer apps fetch error:', dev_err)

        score = detail.get('score')
        rating_text = f"{score:.1f}" if score else '4.7'
        
        raw_size = detail.get('size') or 'Varies with device'
        if not raw_size or 'varies' in raw_size.lower():
            exact_size = get_exact_apk_size(app_id)
            genre = detail.get('genre', '')
            final_size = exact_size or ('1.8 GB' if genre and 'game' in genre.lower() else '85.4 MB')
        else:
            final_size = raw_size

        raw_screenshots = detail.get('screenshots') or [detail.get('icon')]
        
        phone_screenshots = raw_screenshots
        ipad_screenshots = detail.get('ipadScreenshots') or detail.get('tabletScreenshots') or raw_screenshots
        tv_screenshots = detail.get('tvScreenshots') or []

        banner_img = detail.get('headerImage') or detail.get('icon')

        return jsonify({
            'appId': detail.get('appId'),
            'title': detail.get('title'),
            'developer': detail.get('developer'),
            'developerId': detail.get('developerId'),
            'icon': detail.get('icon'),
            'banner': banner_img,
            'rating': rating_text,
            'ratingsCount': detail.get('ratings', 0),
            'reviewsCount': detail.get('reviews', 0),
            'histogram': detail.get('histogram', [0, 0, 0, 0, 0]),
            'screenshots': {
                'phone': phone_screenshots,
                'ipad': ipad_screenshots,
                'appletv': tv_screenshots
            },
            'description': detail.get('descriptionHTML') or detail.get('description'),
            'summary': detail.get('summary') or 'Featured Application',
            'version': detail.get('version', 'Varies with device'),
            'updated': detail.get('updated', 'Recent'),
            'size': final_size,
            'installs': detail.get('installs', '1,000,000+'),
            'contentRating': detail.get('contentRating', 'Everyone'),
            'genre': detail.get('genre', 'Application'),
            'recentChanges': detail.get('recentChanges', 'General bug fixes and performance improvements.'),
            'reviews': formatted_reviews,
            'moreByDeveloper': more_by_dev
        })
    except Exception as err:
        print('App detail error:', err)
        return jsonify({'error': 'App details not found'}), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT, debug=True)