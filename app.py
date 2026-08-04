import os
import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from google_play_scraper import app as gplay_app, search as gplay_search, reviews, Sort
from functools import lru_cache

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')
CORS(app)

PORT = int(os.environ.get('PORT', 5000))

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

@lru_cache(maxsize=100)
def cached_search(query: str, n_hits: int = 15):
    try:
        return gplay_search(query, n_hits=n_hits, lang='en', country='us')
    except Exception as err:
        print(f"Search failed for {query}:", err)
        return []

@lru_cache(maxsize=150)
def cached_app_detail(app_id: str):
    return gplay_app(app_id, lang='en', country='us')

def fetch_fast_apps(query_list):
    all_apps = []
    seen_ids = set()

    for q in query_list[:2]:
        results = cached_search(q, n_hits=15)
        for item in results:
            app_id = item.get('appId')
            if app_id and app_id not in seen_ids:
                seen_ids.add(app_id)
                all_apps.append(format_app_summary(item))

    return all_apps

@app.route('/')
def serve_index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/styles.css')
def serve_css():
    return send_from_directory(BASE_DIR, 'styles.css', mimetype='text/css')

@app.route('/app.js')
def serve_js():
    return send_from_directory(BASE_DIR, 'app.js', mimetype='application/javascript')

@app.route('/api/user/profile', methods=['GET'])
def get_user_profile():
    return jsonify({
        'name': 'Demo User',
        'email': 'user@example.com',
        'avatar': 'https://ui-avatars.com/api/?name=Demo+User&background=0D8ABC&color=fff&size=150'
    })

@app.route('/api/trending', methods=['GET'])
def get_trending():
    queries = ['top free apps', 'editors choice apps']
    apps = fetch_fast_apps(queries)
    return jsonify(apps)

@app.route('/api/apps', methods=['GET'])
def get_apps():
    category = request.args.get('category', 'ALL').upper()
    page = int(request.args.get('page', 1))
    per_page = 10
    
    query_map = {
        'ALL': ['top free apps'],
        'UTILITIES': ['best utilities'],
        'GAMES': ['top action games']
    }
    
    selected_queries = query_map.get(category, query_map['ALL'])
    all_results = fetch_fast_apps(selected_queries)
    
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
    queries = [f'top {cat_clean} apps']
    apps = fetch_fast_apps(queries)
    return jsonify(apps)

@app.route('/api/search', methods=['GET'])
def search_apps():
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify([])
    try:
        apps = fetch_fast_apps([query])
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
        search_res = requests.get(search_url, headers=headers, timeout=5)
        soup = BeautifulSoup(search_res.text, 'html.parser')

        first_title = soup.select_one('.appRow .title')
        if not first_title or not first_title.get('href'):
            return jsonify({'error': 'Release not found'}), 404

        release_url = f"https://www.apkmirror.com{first_title['href']}"
        release_res = requests.get(release_url, headers=headers, timeout=5)
        soup_release = BeautifulSoup(release_res.text, 'html.parser')

        download_btn = soup_release.select_one('a.downloadButton')
        if not download_btn or not download_btn.get('href'):
            return jsonify({'error': 'Download page not found'}), 404

        final_page_url = f"https://www.apkmirror.com{download_btn['href']}"
        final_res = requests.get(final_page_url, headers=headers, timeout=5)
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
            count=5
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

        score = detail.get('score')
        rating_text = f"{score:.1f}" if score else '4.7'
        raw_screenshots = detail.get('screenshots') or [detail.get('icon')]

        return jsonify({
            'appId': detail.get('appId'),
            'title': detail.get('title'),
            'developer': detail.get('developer'),
            'developerId': detail.get('developerId'),
            'icon': detail.get('icon'),
            'banner': detail.get('headerImage') or detail.get('icon'),
            'rating': rating_text,
            'ratingsCount': detail.get('ratings', 0),
            'reviewsCount': detail.get('reviews', 0),
            'histogram': detail.get('histogram', [0, 0, 0, 0, 0]),
            'screenshots': {
                'phone': raw_screenshots,
                'ipad': raw_screenshots,
                'appletv': []
            },
            'description': detail.get('descriptionHTML') or detail.get('description'),
            'summary': detail.get('summary') or 'Featured Application',
            'version': detail.get('version', 'Varies with device'),
            'updated': detail.get('updated', 'Recent'),
            'size': detail.get('size') or '85 MB',
            'installs': detail.get('installs', '1,000,000+'),
            'contentRating': detail.get('contentRating', 'Everyone'),
            'genre': detail.get('genre', 'Application'),
            'recentChanges': detail.get('recentChanges', 'General bug fixes and updates.'),
            'reviews': formatted_reviews,
            'moreByDeveloper': []
        })
    except Exception as err:
        print('App detail error:', err)
        return jsonify({'error': 'App details not found'}), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=PORT, debug=True)
