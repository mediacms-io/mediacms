.PHONY: admin-shell build-frontend backup-db

admin-shell:
	@container_id=$$(docker compose ps -q web); \
	if [ -z "$$container_id" ]; then \
		echo "Web container not found"; \
		exit 1; \
	else \
		docker exec -it $$container_id /bin/bash; \
	fi

build-frontend:
	docker compose -f docker-compose-dev.yaml exec frontend npm run dist
	cp -r frontend/dist/static/* static/
	docker compose -f docker-compose-dev.yaml restart web

test:
	docker compose -f docker-compose-dev.yaml exec --env TESTING=True -T web pytest

backup-db:
	@echo "Creating PostgreSQL database dump..."
	@mkdir -p backups
	@timestamp=$$(date +%Y%m%d_%H%M%S); \
	dump_file="backups/mediacms_dump_$${timestamp}.sql"; \
	docker compose exec -T db pg_dump -U mediacms -d mediacms > "$${dump_file}"; \
	if [ $$? -eq 0 ]; then \
		echo "Database dump created successfully: $${dump_file}"; \
	else \
		echo "Database dump failed"; \
		exit 1; \
	fi

