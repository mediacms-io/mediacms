#!/bin/bash
set -e

echo "========================================="
echo "MediaCMS Migrations Starting..."
echo "========================================="

# Wait for database to be ready
until python manage.py migrate --check 2>/dev/null; do
  echo "Waiting for database to be ready..."
  sleep 2
done

# Run migrations
echo "Running database migrations..."
python manage.py migrate

# Check if this is a new installation
EXISTING_INSTALLATION=$(echo "from users.models import User; print(User.objects.exists())" | python manage.py shell)

if [ "$EXISTING_INSTALLATION" = "True" ]; then
    echo "Existing installation detected, skipping initial data load"
else
    echo "New installation detected, loading initial data..."

    # Load fixtures
    python manage.py loaddata fixtures/encoding_profiles.json
    python manage.py loaddata fixtures/categories.json

    # Create admin user
    RANDOM_ADMIN_PASS=$(python -c "import secrets;chars = 'abcdefghijklmnopqrstuvwxyz0123456789';print(''.join(secrets.choice(chars) for i in range(10)))")
    ADMIN_PASSWORD=${ADMIN_PASSWORD:-$RANDOM_ADMIN_PASS}

    DJANGO_SUPERUSER_PASSWORD=$ADMIN_PASSWORD python manage.py createsuperuser \
        --no-input \
        --username=${ADMIN_USER:-admin} \
        --email=${ADMIN_EMAIL:-admin@localhost} \
        --database=default || true

    echo "========================================="
    echo "Admin user created with password: $ADMIN_PASSWORD"
    echo "========================================="
fi

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "========================================="
echo "Migrations completed successfully!"
echo "========================================="
