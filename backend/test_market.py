import os
db_path = os.path.join(os.path.dirname(__file__), 'market_test.db')
if os.path.exists(db_path):
    os.remove(db_path)
os.environ['DATABASE_URL'] = 'sqlite:///' + db_path.replace('\\', '/')
os.environ['MAIL_USERNAME'] = ''
os.environ['MAIL_PASSWORD'] = ''

import app as app_module

app_module.app.config['TESTING'] = True
client = app_module.app.test_client()


def auth(token):
    return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}


def main():
    missing_policy = client.post('/api/auth/signup', json={
        'name': 'No Policy', 'email': 'nopolicy@market.test', 'password': 'secret12', 'role': 'student'
    })
    assert missing_policy.status_code == 400, missing_policy.get_json()
    missing_email = client.post('/api/auth/email', json={'email': 'ada@market.test'})
    assert missing_email.status_code == 200 and missing_email.get_json()['exists'] is False

    registered = client.post('/api/auth/signup', json={
        'name': 'Ada Owner',
        'email': 'ada@market.test',
        'password': 'secret12',
        'role': 'restaurant',
        'businessName': 'Ada Kitchen',
        'category': 'Meals',
        'phone': '+91 90000 00001',
        'city': 'Gamma 1',
        'address': 'Shop 4, Gamma 1',
        'acceptedPolicy': True,
    })
    assert registered.status_code == 201, registered.get_json()
    known_email = client.post('/api/auth/email', json={'email': 'Ada@market.test'})
    assert known_email.status_code == 200 and known_email.get_json()['exists'] is True
    assert registered.get_json()['user']['role'] == 'restaurant'
    vendor_token = registered.get_json()['access_token']
    mine = client.get('/api/market/mine', headers=auth(vendor_token))
    assert mine.status_code == 200, mine.get_json()
    business_id = mine.get_json()[0]['id']

    listed = client.get('/api/market/businesses?kind=restaurant')
    assert listed.status_code == 200
    assert listed.get_json() == []

    item = client.post(f'/api/market/businesses/{business_id}/items', json={
        'name': 'Jollof', 'price': 300, 'category': 'Rice'
    }, headers=auth(vendor_token))
    assert item.status_code == 201, item.get_json()
    item_id = item.get_json()['id']

    listed = client.get('/api/market/businesses?kind=restaurant')
    assert listed.status_code == 200
    assert 'phone' not in listed.get_json()[0]
    assert listed.get_json()[0]['itemNames'] == ['Jollof']

    public = client.get(f'/api/market/businesses/{business_id}')
    assert 'phone' not in public.get_json()
    assert public.get_json()['address'] if False else 'address' not in public.get_json()

    student = client.post('/api/auth/signup', json={
        'name': 'Bo Student', 'email': 'bo@market.test', 'password': 'secret12', 'role': 'student', 'acceptedPolicy': True
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
        'name': 'Other', 'email': 'other@market.test', 'password': 'secret12', 'role': 'student', 'acceptedPolicy': True
    })
    blocked = client.post(f'/api/market/orders/{order_id}/confirm', json={'result': 'completed'}, headers=auth(other.get_json()['access_token']))
    assert blocked.status_code == 403

    missing = client.put(f'/api/market/orders/{order_id}', json={'status': 'completed'}, headers=auth(vendor_token))
    assert missing.status_code == 400

    accepted = client.put(f'/api/market/orders/{order_id}', json={'status': 'accepted'}, headers=auth(vendor_token))
    assert accepted.status_code == 200

    done = client.put(f'/api/market/orders/{order_id}', json={'status': 'completed', 'finalAmount': 300}, headers=auth(vendor_token))
    assert done.status_code == 200, done.get_json()
    assert done.get_json()['commissionAmount'] == 30
    assert done.get_json()['commissionStatus'] == 'pending_verification'
    assert done.get_json()['commissionRate'] == 10

    changed = client.put('/api/market/admin/commission', json={'percent': 25}, headers=auth(vendor_token))
    assert changed.status_code == 403

    extra = client.post(f'/api/market/businesses/{business_id}/items', json={'name': 'Fried rice', 'price': 250}, headers=auth(vendor_token))
    assert extra.status_code == 201, extra.get_json()
    blocked_meal = client.post('/api/market/orders', json={'itemId': extra.get_json()['id']}, headers=auth(student_token))
    assert blocked_meal.status_code == 400

    confirmed = client.post(f'/api/market/orders/{order_id}/confirm', json={'result': 'completed', 'amount': 300}, headers=auth(student_token))
    assert confirmed.status_code == 200, confirmed.get_json()
    assert confirmed.get_json()['commissionRate'] == 10
    assert confirmed.get_json()['commissionAmount'] == 30
    assert confirmed.get_json()['commissionStatus'] == 'confirmed'

    again = client.post(f'/api/market/orders/{order_id}/confirm', json={'result': 'disputed'}, headers=auth(student_token))
    assert again.status_code == 400

    paid = client.post('/api/market/orders', json={'itemId': item_id, 'quantity': 1}, headers=auth(student_token))
    assert paid.status_code == 201, paid.get_json()
    received = client.put(f"/api/market/orders/{paid.get_json()['id']}", json={'status': 'completed', 'finalAmount': 200}, headers=auth(vendor_token))
    assert received.status_code == 200, received.get_json()
    assert received.get_json()['status'] == 'completed'
    assert received.get_json()['finalAmount'] == 200
    repeat = client.put(f"/api/market/orders/{paid.get_json()['id']}", json={'status': 'completed', 'finalAmount': 200}, headers=auth(vendor_token))
    assert repeat.status_code == 400

    service_owner = client.post('/api/auth/signup', json={
        'name': 'Service Owner', 'email': 'svc@market.test', 'password': 'secret12', 'role': 'service', 'acceptedPolicy': True,
        'businessName': 'Campus Help', 'category': 'Help', 'phone': '+91 90000 00002', 'city': 'Alpha 1'
    })
    assert service_owner.status_code == 201, service_owner.get_json()
    service_token = service_owner.get_json()['access_token']
    service_business = client.get('/api/market/mine', headers=auth(service_token)).get_json()[0]['id']
    first_item = client.post(f'/api/market/businesses/{service_business}/items', json={'name': 'Haircut', 'price': 200}, headers=auth(service_token))
    second_item = client.post(f'/api/market/businesses/{service_business}/items', json={'name': 'Beard trim', 'price': 80}, headers=auth(service_token))
    assert first_item.status_code == 201 and second_item.status_code == 201
    own_request = client.post('/api/market/orders', json={'itemId': first_item.get_json()['id']}, headers=auth(service_token))
    assert own_request.status_code == 201, own_request.get_json()
    first = client.post('/api/market/orders', json={'itemId': first_item.get_json()['id']}, headers=auth(student_token))
    assert first.status_code == 201, first.get_json()
    blocked_second = client.post('/api/market/orders', json={'itemId': second_item.get_json()['id']}, headers=auth(student_token))
    assert blocked_second.status_code == 400
    marked = client.put(f"/api/market/orders/{first.get_json()['id']}", json={'status': 'completed', 'finalAmount': 200}, headers=auth(service_token))
    assert marked.status_code == 200, marked.get_json()
    still_blocked = client.post('/api/market/orders', json={'itemId': second_item.get_json()['id']}, headers=auth(student_token))
    assert still_blocked.status_code == 400
    empty_note = client.post(f"/api/market/orders/{first.get_json()['id']}/confirm", json={'result': 'disputed'}, headers=auth(student_token))
    assert empty_note.status_code == 400
    confirmed = client.post(f"/api/market/orders/{first.get_json()['id']}/confirm", json={'result': 'completed', 'note': 'Paid in cash'}, headers=auth(student_token))
    assert confirmed.status_code == 200, confirmed.get_json()
    assert confirmed.get_json()['customerNote'] == 'Paid in cash'
    second = client.post('/api/market/orders', json={'itemId': second_item.get_json()['id']}, headers=auth(student_token))
    assert second.status_code == 201, second.get_json()

    housing = client.post('/api/auth/signup', json={
        'name': 'No Vendor', 'email': 'nope@market.test', 'password': 'secret12', 'role': 'vendor'
    })
    assert housing.status_code == 400
    closed = client.post('/api/market/buyer/register', json={'name': 'Buyer', 'email': 'b@market.test', 'password': 'secret12'})
    assert closed.status_code == 404
    with app_module.app.app_context():
        owner = app_module.User.query.filter_by(email='ada@market.test').first()
        owner.role = 'shop'
        app_module.db.session.commit()
    shop_view = client.get('/api/market/vendor/orders', headers=auth(vendor_token))
    assert shop_view.status_code == 200
    assert all(row['kind'] == 'shop' for row in shop_view.get_json())
    with app_module.app.app_context():
        owner = app_module.User.query.filter_by(email='ada@market.test').first()
        owner.role = 'restaurant'
        app_module.db.session.commit()

    admin = client.post('/api/auth/login', json={'email': 'admin@test.com', 'password': 'admin123', 'role': 'admin'})
    assert admin.status_code == 200, admin.get_json()
    activity = client.get('/api/market/admin/orders?kind=restaurant', headers=auth(admin.get_json()['access_token']))
    assert activity.status_code == 200, activity.get_json()
    restaurant_rows = activity.get_json()
    match = next(row for row in restaurant_rows['orders'] if row['itemName'] == 'Jollof')
    assert match['customerName'] == 'Bo Student'
    assert match['customerEmail'] == 'bo@market.test'
    assert 'customerPhone' in match
    place = next(row for row in restaurant_rows['places'] if row['name'] == 'Ada Kitchen')
    assert place['ownerPhone'] == '+91 90000 00001'
    locked_rate = client.put('/api/market/admin/commission', json={'percent': 25}, headers=auth(admin.get_json()['access_token']))
    assert locked_rate.status_code == 400, locked_rate.get_json()
    shop_only = client.get('/api/market/admin/orders?kind=shop', headers=auth(admin.get_json()['access_token']))
    assert shop_only.status_code == 200
    assert all(row['kind'] == 'shop' for row in shop_only.get_json()['orders'])
    assert all(row['kind'] == 'shop' for row in shop_only.get_json()['places'])
    created = client.post('/api/market/businesses', json={
        'kind': 'restaurant', 'name': 'Delete Me Kitchen', 'category': 'Meals', 'area': 'Alpha 1', 'phone': '+91 90000 00009',
    }, headers=auth(vendor_token))
    assert created.status_code == 201, created.get_json()
    place_id = created.get_json()['id']
    denied = client.delete(f'/api/market/admin/businesses/{place_id}', headers=auth(vendor_token))
    assert denied.status_code == 403, denied.get_json()
    removed = client.delete(f'/api/market/admin/businesses/{place_id}', headers=auth(admin.get_json()['access_token']))
    assert removed.status_code == 200, removed.get_json()
    after = client.get('/api/market/admin/orders?kind=restaurant', headers=auth(admin.get_json()['access_token']))
    assert all(row['id'] != place_id for row in after.get_json()['places'])

    landlord = client.post('/api/auth/signup', json={
        'name': 'House Owner', 'email': 'houses@market.test', 'password': 'secret12', 'role': 'landlord',
        'phone': '+91 90000 00077', 'city': 'Alpha 1', 'acceptedPolicy': True,
    })
    assert landlord.status_code == 201, landlord.get_json()
    landlord_token = landlord.get_json()['access_token']
    landlord_id = landlord.get_json()['user']['id']
    listed_room = client.post('/api/listings', json={
        'title': 'Rented Room', 'type': 'Room', 'rent': 10000, 'address': 'Lane 1',
        'sector': 'Alpha 1', 'city': 'Greater Noida', 'description': 'A quiet room', 'available': 'now',
    }, headers=auth(landlord_token))
    assert listed_room.status_code == 201, listed_room.get_json()
    room_id = listed_room.get_json()['id']
    renter = client.post('/api/auth/signup', json={
        'name': 'Renter', 'email': 'renter@market.test', 'password': 'secret12', 'role': 'student', 'acceptedPolicy': True,
    })
    assert renter.status_code == 201, renter.get_json()
    renter_token = renter.get_json()['access_token']
    receipt = client.post('/api/unlocks', json={'listingId': room_id, 'receiptUrl': 'https://example.com/receipt.png'}, headers=auth(renter_token))
    assert receipt.status_code == 201, receipt.get_json()
    assert any(row['id'] == room_id for row in client.get('/api/listings').get_json())
    meal = client.post('/api/market/orders', json={'itemId': item_id, 'quantity': 1}, headers=auth(landlord_token))
    assert meal.status_code == 201, meal.get_json()
    approved = client.put(f"/api/admin/unlocks/{receipt.get_json()['id']}", json={'status': 'approved'}, headers=auth(admin.get_json()['access_token']))
    assert approved.status_code == 200, approved.get_json()
    assert all(row['id'] != room_id for row in client.get('/api/listings').get_json())
    assert any(row['id'] == room_id for row in client.get('/api/listings', headers=auth(renter_token)).get_json())
    removed_owner = client.delete(f'/api/admin/users/{landlord_id}', headers=auth(admin.get_json()['access_token']))
    assert removed_owner.status_code == 200, removed_owner.get_json()
    assert all(row['id'] != room_id for row in client.get('/api/listings', headers=auth(admin.get_json()['access_token'])).get_json())

    print('market checks passed')


if __name__ == '__main__':
    try:
        main()
    finally:
        with app_module.app.app_context():
            app_module.db.session.remove()
            app_module.db.engine.dispose()
        if os.path.exists(db_path):
            os.remove(db_path)
