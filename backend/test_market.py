import os
os.environ['DATABASE_URL'] = 'sqlite:///market_test.db'

import app as app_module

app_module.app.config['TESTING'] = True
client = app_module.app.test_client()


def auth(token):
    return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}


def main():
    registered = client.post('/api/market/register', json={
        'ownerName': 'Ada Vendor',
        'email': 'ada@market.test',
        'password': 'secret12',
        'kind': 'restaurant',
        'name': 'Ada Kitchen',
        'category': 'Meals',
        'phone': '+91 90000 00001',
        'whatsapp': '+91 90000 00001',
        'area': 'Gamma 1',
        'address': 'Shop 4, Gamma 1',
    })
    assert registered.status_code == 201, registered.get_json()
    vendor_token = registered.get_json()['access_token']
    business_id = registered.get_json()['business']['id']

    listed = client.get('/api/market/businesses?kind=restaurant')
    assert listed.status_code == 200
    assert 'phone' not in listed.get_json()[0]

    item = client.post(f'/api/market/businesses/{business_id}/items', json={
        'name': 'Jollof', 'price': 300, 'category': 'Rice'
    }, headers=auth(vendor_token))
    assert item.status_code == 201, item.get_json()
    item_id = item.get_json()['id']

    public = client.get(f'/api/market/businesses/{business_id}')
    assert 'phone' not in public.get_json()
    assert public.get_json()['address'] if False else 'address' not in public.get_json()

    student = client.post('/api/auth/signup', json={
        'name': 'Bo Student', 'email': 'bo@market.test', 'password': 'secret12', 'role': 'student'
    })
    assert student.status_code == 201, student.get_json()
    student_token = student.get_json()['access_token']

    order = client.post('/api/market/orders', json={'itemId': item_id, 'quantity': 1}, headers=auth(student_token))
    assert order.status_code == 201, order.get_json()
    body = order.get_json()
    assert body['reference'].startswith('M-')
    assert body['contact']['phone'] == '+91 90000 00001'
    order_id = body['id']

    other = client.post('/api/auth/signup', json={
        'name': 'Other', 'email': 'other@market.test', 'password': 'secret12', 'role': 'student'
    })
    blocked = client.post(f'/api/market/orders/{order_id}/confirm', json={'result': 'completed'}, headers=auth(other.get_json()['access_token']))
    assert blocked.status_code == 403

    jumped = client.put(f'/api/market/orders/{order_id}', json={'status': 'completed', 'finalAmount': 300}, headers=auth(vendor_token))
    assert jumped.status_code == 400

    accepted = client.put(f'/api/market/orders/{order_id}', json={'status': 'accepted'}, headers=auth(vendor_token))
    assert accepted.status_code == 200

    done = client.put(f'/api/market/orders/{order_id}', json={'status': 'completed', 'finalAmount': 300}, headers=auth(vendor_token))
    assert done.status_code == 200, done.get_json()
    assert done.get_json()['commissionAmount'] == 30
    assert done.get_json()['commissionStatus'] == 'pending_verification'
    assert done.get_json()['commissionRate'] == 10

    changed = client.put('/api/market/admin/commission', json={'percent': 25}, headers=auth(vendor_token))
    assert changed.status_code == 403

    confirmed = client.post(f'/api/market/orders/{order_id}/confirm', json={'result': 'completed', 'amount': 300}, headers=auth(student_token))
    assert confirmed.status_code == 200, confirmed.get_json()
    assert confirmed.get_json()['commissionRate'] == 10
    assert confirmed.get_json()['commissionAmount'] == 30
    assert confirmed.get_json()['commissionStatus'] == 'confirmed'

    again = client.post(f'/api/market/orders/{order_id}/confirm', json={'result': 'disputed'}, headers=auth(student_token))
    assert again.status_code == 400

    housing = client.post('/api/auth/signup', json={
        'name': 'No Vendor', 'email': 'nope@market.test', 'password': 'secret12', 'role': 'vendor'
    })
    assert housing.status_code == 400
    print('market checks passed')


if __name__ == '__main__':
    try:
        main()
    finally:
        db_path = os.path.join(os.path.dirname(__file__), 'market_test.db')
        if os.path.exists(db_path):
            os.remove(db_path)
