import urllib.request

paths = ['/monthly', '/insights', '/expenses']
for path in paths:
    url = 'http://127.0.0.1:5000' + path
    try:
        resp = urllib.request.urlopen(url, timeout=10)
        data = resp.read().decode('utf-8')
        print('PATH', path, 'LENGTH', len(data))
        print(data[:400])
        print('---')
    except Exception as e:
        print('ERR', path, e)
