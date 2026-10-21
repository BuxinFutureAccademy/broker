#!/usr/bin/env python3
"""
Setup script for StudentStay backend
Run this to initialize the database and verify configuration
"""

import os
import sys
from dotenv import load_dotenv

def check_dependencies():
    """Check if required Python packages are installed"""
    required = ['flask', 'flask_cors', 'flask_jwt_extended', 'cloudinary', 
                'flask_mail', 'bcrypt', 'sqlalchemy', 'flask_sqlalchemy']
    
    missing = []
    for package in required:
        try:
            __import__(package.replace('_', '-'))
        except ImportError:
            missing.append(package)
    
    if missing:
        print("❌ Missing required packages:")
        for pkg in missing:
            print(f"   - {pkg}")
        print("\nRun: pip install -r requirements.txt")
        return False
    
    print("✅ All dependencies installed")
    return True

def check_env_file():
    """Check if .env file exists"""
    if not os.path.exists('.env'):
        print("❌ .env file not found")
        print("Copy .env.example to .env and fill in your values:")
        print("   cp .env.example .env")
        return False
    
    print("✅ .env file found")
    return True

def check_env_vars():
    """Check if required environment variables are set"""
    load_dotenv()
    
    required = ['JWT_SECRET_KEY', 'CLOUDINARY_CLOUD_NAME', 
                'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
                'MAIL_SERVER', 'MAIL_USERNAME', 'MAIL_PASSWORD']
    
    missing = []
    for var in required:
        if not os.getenv(var):
            missing.append(var)
    
    if missing:
        print("❌ Missing environment variables:")
        for var in missing:
            print(f"   - {var}")
        print("\nAdd these to your .env file")
        return False
    
    print("✅ All required environment variables set")
    return True

def init_database():
    """Initialize the database"""
    try:
        from app import app, db
        with app.app_context():
            db.create_all()
            print("✅ Database initialized successfully")
            return True
    except Exception as e:
        print(f"❌ Database initialization failed: {e}")
        return False

def main():
    print("=" * 50)
    print("StudentStay Backend Setup")
    print("=" * 50)
    print()
    
    checks = [
        ("Dependencies", check_dependencies),
        ("Environment file", check_env_file),
        ("Environment variables", check_env_vars),
        ("Database", init_database)
    ]
    
    all_passed = True
    for name, check_func in checks:
        print(f"Checking {name}...")
        if not check_func():
            all_passed = False
        print()
    
    if all_passed:
        print("=" * 50)
        print("✅ Setup complete! You can now run:")
        print("   python app.py")
        print("=" * 50)
        return 0
    else:
        print("=" * 50)
        print("❌ Setup incomplete. Please fix the errors above.")
        print("=" * 50)
        return 1

if __name__ == '__main__':
    sys.exit(main())
