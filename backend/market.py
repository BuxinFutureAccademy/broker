"""Restaurants, shops, and services. Housing routes stay in app.py."""

KINDS = ('restaurant', 'shop', 'service')
VENDOR_MOVES = {
    'pending': {'accepted', 'cancelled'},
    'accepted': {'completed', 'cancelled'},
}
CONFIRMATIONS = {'completed', 'not_completed', 'disputed'}
COMMISSION_STATUSES = {'pending_verification', 'confirmed', 'due', 'paid', 'disputed', 'waived'}


def init_market():
    import uuid
    from datetime import datetime, timedelta
    from flask import jsonify, request
    from flask_jwt_extended import get_jwt_identity, jwt_required
    import app as app_module

    app = app_module.app
    db = app_module.db
    User = app_module.User
    Business = app_module.Business
    CatalogItem = app_module.CatalogItem
    MarketOrder = app_module.MarketOrder
    MarketAudit = app_module.MarketAudit
    MarketSetting = app_module.MarketSetting
    OWNER_ROLES = ('restaurant', 'shop', 'service', 'vendor')

    def is_owner(user):
        return bool(user and user.role in OWNER_ROLES)

    def clean_text(value, limit):
        return str(value or '').strip()[:limit]

    def clean_money(value):
        try:
            amount = int(value)
        except (TypeError, ValueError):
            return None
        if amount < 0 or amount > 10000000:
            return None
        return amount

    def current_user():
        return User.query.get(get_jwt_identity())

    def commission_rate():
        setting = MarketSetting.query.first()
        if not setting:
            setting = MarketSetting(commission_percent=10)
            db.session.add(setting)
            db.session.commit()
        rate = int(setting.commission_percent or 0)
        return max(0, min(rate, 100))

    def commission_amount(total, rate):
        return (int(total) * int(rate) + 50) // 100

    def new_reference():
        import secrets
        alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        for _ in range(8):
            reference = 'M-' + ''.join(secrets.choice(alphabet) for _ in range(6))
            if not MarketOrder.query.filter_by(reference=reference).first():
                return reference
        return 'M-' + uuid.uuid4().hex[:8].upper()

    def audit(order, actor, action, note=''):
        db.session.add(MarketAudit(
            order_id=order.id,
            actor_id=actor.id if actor else '',
            action=action[:40],
            note=clean_text(note, 200)
        ))

    def item_payload(item):
        return {
            'id': item.id,
            'name': item.name,
            'description': item.description or '',
            'price': item.price or 0,
            'priceNote': item.price_note or '',
            'photoUrl': item.photo_url or '',
            'category': item.category or '',
            'available': bool(item.available),
            'stock': item.stock,
        }

    def business_payload(row, include_contact=False, include_items=True):
        data = {
            'id': row.id,
            'kind': row.kind,
            'name': row.name,
            'category': row.category,
            'description': row.description or '',
            'area': row.area or '',
            'hours': row.hours or '',
            'logoUrl': row.logo_url or '',
            'imageUrl': row.image_url or '',
            'status': row.status or 'active',
        }
        if include_contact:
            data['phone'] = row.phone or ''
            data['whatsapp'] = row.whatsapp or ''
            data['address'] = row.address or ''
        if include_items:
            items = CatalogItem.query.filter_by(business_id=row.id).order_by(CatalogItem.created.desc()).all()
            data['items'] = [item_payload(item) for item in items]
        return data

    def contact_payload(row):
        return {
            'name': row.name,
            'phone': row.phone or '',
            'whatsapp': row.whatsapp or '',
            'address': row.address or '',
            'area': row.area or '',
        }

    def order_payload(order, include_contact=False):
        business = Business.query.get(order.business_id)
        data = {
            'id': order.id,
            'reference': order.reference,
            'kind': order.kind,
            'businessId': order.business_id,
            'businessName': business.name if business else '',
            'itemName': order.item_name,
            'quantity': order.quantity,
            'listedPrice': order.listed_price,
            'listedTotal': order.listed_total,
            'finalAmount': order.final_amount,
            'status': order.status,
            'customerConfirm': order.customer_confirm or '',
            'customerAmount': order.customer_amount,
            'commissionRate': order.commission_rate,
            'commissionAmount': order.commission_amount,
            'commissionStatus': order.commission_status or '',
            'created': order.created.isoformat() if order.created else None,
        }
        if include_contact and business:
            data['contact'] = contact_payload(business)
        return data

    def read_business(data, row=None):
        kind = clean_text(data.get('kind') or (row.kind if row else ''), 20)
        if kind not in KINDS:
            return None, 'Choose restaurant, shop, or service.'
        name = clean_text(data.get('name'), 120)
        category = clean_text(data.get('category'), 80)
        if not name or not category:
            return None, 'Add the business name and category.'
        phone = clean_text(data.get('phone'), 30)
        if not phone:
            return None, 'Add a phone number customers can call.'
        fields = {
            'kind': kind,
            'name': name,
            'category': category,
            'description': clean_text(data.get('description'), 2000),
            'phone': phone,
            'whatsapp': clean_text(data.get('whatsapp'), 30),
            'address': clean_text(data.get('address'), 200),
            'area': clean_text(data.get('area'), 80) or 'Greater Noida',
            'hours': clean_text(data.get('hours'), 120),
            'logo_url': clean_text(data.get('logoUrl') or data.get('logo_url'), 500),
            'image_url': clean_text(data.get('imageUrl') or data.get('image_url'), 500),
        }
        return fields, None

    def apply_business(row, fields):
        for key, value in fields.items():
            setattr(row, key, value)

    @app.route('/api/market/businesses', methods=['GET'])
    def market_businesses():
        kind = clean_text(request.args.get('kind'), 20)
        query = clean_text(request.args.get('q'), 80).lower()
        area = clean_text(request.args.get('area'), 80).lower()
        rows = Business.query.filter_by(status='active')
        if kind in KINDS:
            rows = rows.filter_by(kind=kind)
        result = []
        for row in rows.order_by(Business.created.desc()).all():
            if area and area not in (row.area or '').lower() and area not in (row.address or '').lower():
                continue
            items = CatalogItem.query.filter_by(business_id=row.id, available=True).order_by(CatalogItem.created.desc()).all()
            blob = ' '.join([row.name, row.category, row.description or '', row.area or ''] + [item.name for item in items]).lower()
            if query and query not in blob:
                continue
            card = business_payload(row, include_items=False)
            card['itemCount'] = len(items)
            card['itemNames'] = [item.name for item in items]
            card['fromPrice'] = min((item.price or 0 for item in items), default=None)
            card['offers'] = [{
                'id': item.id,
                'name': item.name,
                'description': item.description or '',
                'price': item.price or 0,
                'photoUrl': item.photo_url or '',
            } for item in items]
            result.append(card)
        return jsonify(result)

    @app.route('/api/market/businesses/<business_id>', methods=['GET'])
    def market_business(business_id):
        row = Business.query.get(business_id)
        if not row:
            return jsonify({'error': 'That business is not listed.'}), 404
        if row.status != 'active':
            viewer = None
            try:
                from flask_jwt_extended import verify_jwt_in_request
                verify_jwt_in_request(optional=True)
                viewer = current_user()
            except Exception:
                viewer = None
            if not viewer or (viewer.id != row.owner_id and viewer.role != 'admin'):
                return jsonify({'error': 'That business is not listed.'}), 404
        return jsonify(business_payload(row, include_contact=False))

    @app.route('/api/market/mine', methods=['GET'])
    @jwt_required()
    def market_mine():
        user = current_user()
        if not is_owner(user):
            return jsonify({'error': 'Sign in as a restaurant, shop, or service to manage this.'}), 403
        rows = Business.query.filter_by(owner_id=user.id).order_by(Business.created.desc()).all()
        return jsonify([business_payload(row, include_contact=True) for row in rows])

    @app.route('/api/market/businesses', methods=['POST'])
    @jwt_required()
    def market_create_business():
        user = current_user()
        if not is_owner(user):
            return jsonify({'error': 'Sign in as a restaurant, shop, or service to add a business.'}), 403
        fields, error = read_business(request.get_json() or {})
        if error:
            return jsonify({'error': error}), 400
        if user.role in ('restaurant', 'shop', 'service') and fields['kind'] != user.role:
            return jsonify({'error': 'This account can only add another place of the same type.'}), 400
        row = Business(id=str(uuid.uuid4()), owner_id=user.id, status='active')
        apply_business(row, fields)
        db.session.add(row)
        db.session.commit()
        return jsonify(business_payload(row, include_contact=True)), 201

    @app.route('/api/market/businesses/<business_id>', methods=['PUT'])
    @jwt_required()
    def market_update_business(business_id):
        user = current_user()
        row = Business.query.get(business_id)
        if not row or not user or (user.id != row.owner_id and user.role != 'admin'):
            return jsonify({'error': 'You cannot edit that business.'}), 403
        if user.role == 'admin' and 'status' in (request.get_json() or {}):
            status = clean_text((request.get_json() or {}).get('status'), 20)
            if status in ('active', 'suspended'):
                row.status = status
                db.session.commit()
                return jsonify(business_payload(row, include_contact=True))
        fields, error = read_business(request.get_json() or {}, row)
        if error:
            return jsonify({'error': error}), 400
        apply_business(row, fields)
        db.session.commit()
        return jsonify(business_payload(row, include_contact=True))

    def owned_business(user, business_id):
        row = Business.query.get(business_id)
        if not row or not user or user.id != row.owner_id:
            return None
        return row

    @app.route('/api/market/businesses/<business_id>/items', methods=['POST'])
    @jwt_required()
    def market_add_item(business_id):
        user = current_user()
        business = owned_business(user, business_id)
        if not business:
            return jsonify({'error': 'You can only add items to your own business.'}), 403
        data = request.get_json() or {}
        name = clean_text(data.get('name'), 120)
        price = clean_money(data.get('price'))
        if not name or price is None:
            return jsonify({'error': 'Add a name and a price in rupees.'}), 400
        stock = data.get('stock')
        if stock in ('', None):
            stock_value = None
        else:
            stock_value = clean_money(stock)
            if stock_value is None:
                return jsonify({'error': 'Stock must be a whole number.'}), 400
        item = CatalogItem(
            id=str(uuid.uuid4()),
            business_id=business.id,
            name=name,
            description=clean_text(data.get('description'), 2000),
            price=price,
            price_note=clean_text(data.get('priceNote'), 80),
            photo_url=clean_text(data.get('photoUrl'), 500),
            category=clean_text(data.get('category'), 80),
            available=bool(data.get('available', True)),
            stock=stock_value
        )
        db.session.add(item)
        db.session.commit()
        return jsonify(item_payload(item)), 201

    @app.route('/api/market/items/<item_id>', methods=['PUT'])
    @jwt_required()
    def market_update_item(item_id):
        user = current_user()
        item = CatalogItem.query.get(item_id)
        business = Business.query.get(item.business_id) if item else None
        if not item or not business or not user or user.id != business.owner_id:
            return jsonify({'error': 'You can only edit your own items.'}), 403
        data = request.get_json() or {}
        if 'name' in data:
            item.name = clean_text(data.get('name'), 120) or item.name
        if 'description' in data:
            item.description = clean_text(data.get('description'), 2000)
        if 'price' in data:
            price = clean_money(data.get('price'))
            if price is None:
                return jsonify({'error': 'Add a price in rupees.'}), 400
            item.price = price
        if 'priceNote' in data:
            item.price_note = clean_text(data.get('priceNote'), 80)
        if 'photoUrl' in data:
            item.photo_url = clean_text(data.get('photoUrl'), 500)
        if 'category' in data:
            item.category = clean_text(data.get('category'), 80)
        if 'available' in data:
            item.available = bool(data.get('available'))
        if 'stock' in data:
            if data.get('stock') in ('', None):
                item.stock = None
            else:
                stock_value = clean_money(data.get('stock'))
                if stock_value is None:
                    return jsonify({'error': 'Stock must be a whole number.'}), 400
                item.stock = stock_value
        db.session.commit()
        return jsonify(item_payload(item))

    @app.route('/api/market/items/<item_id>', methods=['DELETE'])
    @jwt_required()
    def market_delete_item(item_id):
        user = current_user()
        item = CatalogItem.query.get(item_id)
        business = Business.query.get(item.business_id) if item else None
        if not item or not business or not user or user.id != business.owner_id:
            return jsonify({'error': 'You can only remove your own items.'}), 403
        db.session.delete(item)
        db.session.commit()
        return jsonify({'message': 'Item removed'})

    @app.route('/api/market/orders', methods=['POST'])
    @jwt_required()
    def market_create_order():
        user = current_user()
        if not user:
            return jsonify({'error': 'Sign in before you request this.'}), 401
        data = request.get_json() or {}
        item = CatalogItem.query.get(clean_text(data.get('itemId') or data.get('item_id'), 36))
        business = Business.query.get(item.business_id) if item else None
        if not item or not business or business.status != 'active' or not item.available:
            return jsonify({'error': 'That item is not available.'}), 400
        if user.id == business.owner_id:
            return jsonify({'error': 'You cannot request your own item.'}), 400
        quantity = clean_money(data.get('quantity') or 1) or 1
        if business.kind == 'service':
            quantity = 1
        if quantity < 1 or quantity > 20:
            return jsonify({'error': 'Choose a quantity from 1 to 20.'}), 400
        if item.stock is not None and item.stock < quantity:
            return jsonify({'error': 'There is not enough stock for that quantity.'}), 400
        recent = MarketOrder.query.filter_by(customer_id=user.id, item_id=item.id, status='pending').order_by(MarketOrder.created.desc()).first()
        if recent and recent.created and recent.created > datetime.utcnow() - timedelta(seconds=60):
            return jsonify(order_payload(recent, include_contact=True))
        order = MarketOrder(
            id=str(uuid.uuid4()),
            reference=new_reference(),
            customer_id=user.id,
            owner_id=business.owner_id,
            business_id=business.id,
            item_id=item.id,
            kind=business.kind,
            item_name=item.name,
            item_description=item.description or '',
            listed_price=item.price or 0,
            quantity=quantity,
            listed_total=(item.price or 0) * quantity,
            status='pending'
        )
        db.session.add(order)
        audit(order, user, 'created', order.reference)
        db.session.commit()
        return jsonify(order_payload(order, include_contact=True)), 201

    @app.route('/api/market/my-orders', methods=['GET'])
    @jwt_required()
    def market_my_orders():
        user = current_user()
        if not user:
            return jsonify({'error': 'Sign in required'}), 401
        rows = MarketOrder.query.filter_by(customer_id=user.id).order_by(MarketOrder.created.desc()).limit(50).all()
        return jsonify([order_payload(row, include_contact=True) for row in rows])

    @app.route('/api/market/vendor/orders', methods=['GET'])
    @jwt_required()
    def market_vendor_orders():
        user = current_user()
        if not is_owner(user):
            return jsonify({'error': 'Sign in as a restaurant, shop, or service to manage this.'}), 403
        rows = MarketOrder.query.filter_by(owner_id=user.id).order_by(MarketOrder.created.desc()).limit(100).all()
        result = []
        for row in rows:
            customer = User.query.get(row.customer_id)
            payload = order_payload(row, include_contact=False)
            payload['customer'] = {
                'name': customer.name if customer else 'Customer',
                'phone': customer.phone if customer else '',
                'email': customer.email if customer else '',
            }
            result.append(payload)
        return jsonify(result)

    @app.route('/api/market/orders/<order_id>', methods=['PUT'])
    @jwt_required()
    def market_update_order(order_id):
        user = current_user()
        order = MarketOrder.query.get(order_id)
        if not order or not user or user.id != order.owner_id:
            return jsonify({'error': 'You cannot update that request.'}), 403
        data = request.get_json() or {}
        status = clean_text(data.get('status'), 20)
        allowed = VENDOR_MOVES.get(order.status, set())
        if status not in allowed:
            return jsonify({'error': 'That status change is not allowed.'}), 400
        if status == 'completed':
            amount = clean_money(data.get('finalAmount') if 'finalAmount' in data else data.get('final_amount'))
            if amount is None:
                return jsonify({'error': 'Enter the final sale amount in rupees.'}), 400
            rate = commission_rate()
            order.final_amount = amount
            order.commission_rate = rate
            order.commission_amount = commission_amount(amount, rate)
            order.commission_status = 'pending_verification'
            item = CatalogItem.query.get(order.item_id)
            if item and item.stock is not None:
                item.stock = max(0, item.stock - order.quantity)
        order.status = status
        order.updated = datetime.utcnow()
        audit(order, user, status, f'final {order.final_amount}' if status == 'completed' else '')
        db.session.commit()
        return jsonify(order_payload(order, include_contact=False))

    @app.route('/api/market/orders/<order_id>/confirm', methods=['POST'])
    @jwt_required()
    def market_confirm_order(order_id):
        user = current_user()
        order = MarketOrder.query.get(order_id)
        if not order or not user or user.id != order.customer_id:
            return jsonify({'error': 'You cannot confirm that request.'}), 403
        if order.status != 'completed':
            return jsonify({'error': 'Confirm a request only after the vendor marks it completed.'}), 400
        if order.customer_confirm:
            return jsonify({'error': 'This request already has your answer.'}), 400
        data = request.get_json() or {}
        result = clean_text(data.get('result'), 20)
        if result not in CONFIRMATIONS:
            return jsonify({'error': 'Choose completed, not completed, or a dispute.'}), 400
        amount = None
        if data.get('amount') not in (None, ''):
            amount = clean_money(data.get('amount'))
            if amount is None:
                return jsonify({'error': 'The amount must be a whole number of rupees.'}), 400
        order.customer_confirm = result
        order.customer_amount = amount
        if result == 'completed':
            order.commission_status = 'confirmed'
        else:
            order.status = 'disputed'
            order.commission_status = 'disputed'
        order.updated = datetime.utcnow()
        audit(order, user, 'confirm_' + result, '' if amount is None else f'customer amount {amount}')
        db.session.commit()
        return jsonify(order_payload(order, include_contact=True))

    @app.route('/api/market/admin/orders', methods=['GET'])
    @jwt_required()
    def market_admin_orders():
        user = current_user()
        if not user or user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        kind = clean_text(request.args.get('kind'), 20)
        status = clean_text(request.args.get('status'), 20)
        rows = MarketOrder.query
        if kind in KINDS:
            rows = rows.filter_by(kind=kind)
        if status:
            rows = rows.filter_by(status=status)
        payload = []
        for row in rows.order_by(MarketOrder.created.desc()).limit(200).all():
            item = order_payload(row, include_contact=False)
            vendor = User.query.get(row.owner_id)
            customer = User.query.get(row.customer_id)
            item['vendorName'] = vendor.name if vendor else ''
            item['customerName'] = customer.name if customer else ''
            payload.append(item)
        return jsonify({'commissionPercent': commission_rate(), 'orders': payload})

    @app.route('/api/market/admin/commission', methods=['PUT'])
    @jwt_required()
    def market_admin_commission():
        user = current_user()
        if not user or user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        rate = clean_money((request.get_json() or {}).get('percent'))
        if rate is None or rate > 100:
            return jsonify({'error': 'Enter a commission percent from 0 to 100.'}), 400
        setting = MarketSetting.query.first() or MarketSetting()
        setting.commission_percent = rate
        db.session.add(setting)
        db.session.commit()
        return jsonify({'commissionPercent': rate})

    @app.route('/api/market/admin/orders/<order_id>/commission', methods=['PUT'])
    @jwt_required()
    def market_admin_commission_status(order_id):
        user = current_user()
        order = MarketOrder.query.get(order_id)
        if not user or user.role != 'admin' or not order:
            return jsonify({'error': 'Admin access required'}), 403
        status = clean_text((request.get_json() or {}).get('status'), 30)
        if status not in COMMISSION_STATUSES:
            return jsonify({'error': 'Choose a commission status.'}), 400
        if status == 'paid' and order.commission_amount is None:
            return jsonify({'error': 'There is no commission to mark paid until a sale amount is recorded.'}), 400
        order.commission_status = status
        audit(order, user, 'commission_' + status, '')
        db.session.commit()
        return jsonify(order_payload(order))

    @app.route('/api/market/admin/businesses/<business_id>', methods=['PUT'])
    @jwt_required()
    def market_admin_business(business_id):
        user = current_user()
        row = Business.query.get(business_id)
        if not user or user.role != 'admin' or not row:
            return jsonify({'error': 'Admin access required'}), 403
        status = clean_text((request.get_json() or {}).get('status'), 20)
        if status not in ('active', 'suspended'):
            return jsonify({'error': 'Choose active or suspended.'}), 400
        row.status = status
        db.session.commit()
        return jsonify(business_payload(row, include_contact=True))

