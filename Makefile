.PHONY: admin-shell build-frontend

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

build-base-image:
	docker build -t mediacms/mediacms:latest --target base .

build-full-image:
	docker build -t mediacms/mediacms:full --target full .
