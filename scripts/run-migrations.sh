#!/bin/bash
set -e

echo "========================================="
echo "MediaCMS Migrations Starting..."
echo "========================================="

# Ensure virtualenv is activated
export VIRTUAL_ENV=/home/mediacms.io
export PATH="$VIRTUAL_ENV/bin:$PATH"

# Use explicit python path from virtualenv
PYTHON="$VIRTUAL_ENV/bin/python"

echo "Using Python: $PYTHON"
$PYTHON --version

# Run migrations
echo "Running database migrations..."
$PYTHON manage.py migrate

# Check if this is a new installation
EXISTING_INSTALLATION=$(echo "from users.models import User; print(User.objects.exists())" | $PYTHON manage.py shell)

if [ "$EXISTING_INSTALLATION" = "True" ]; then
    echo "Existing installation detected, skipping initial data load"
else
    echo "New installation detected, loading initial data..."

    # Load fixtures
    $PYTHON manage.py loaddata fixtures/encoding_profiles.json
    $PYTHON manage.py loaddata fixtures/categories.json

    # Create admin user
    RANDOM_ADMIN_PASS=$($PYTHON -c "import secrets;chars = 'abcdefghijklmnopqrstuvwxyz0123456789';print(''.join(secrets.choice(chars) for i in range(10)))")
    ADMIN_PASSWORD=${ADMIN_PASSWORD:-$RANDOM_ADMIN_PASS}

    DJANGO_SUPERUSER_PASSWORD=$ADMIN_PASSWORD $PYTHON manage.py createsuperuser \
        --no-input \
        --username=${ADMIN_USER:-admin} \
        --email=${ADMIN_EMAIL:-admin@localhost} \
        --database=default || true

    echo "========================================="
    echo "Admin user created with password: $ADMIN_PASSWORD"
    echo "========================================="
fi

echo "========================================="
echo "Migrations completed successfully!"
echo "========================================="
