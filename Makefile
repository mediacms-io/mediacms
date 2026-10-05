.PHONY: admin-shell build-frontend test test-coverage test-frontend test-frontend-coverage

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
	docker compose -f docker-compose-dev.yaml exec --env TESTING=True -T web pytest -n auto

test-coverage:
	docker compose -f docker-compose-dev.yaml exec --env TESTING=True -T web pytest -n auto --cov --cov-report=term --cov-report=html

test-frontend:
	docker compose -f docker-compose-dev.yaml exec -T frontend npm run test -- --ci

test-frontend-coverage:
	docker compose -f docker-compose-dev.yaml exec -T frontend npm run test-coverage -- --ci --coverageReporters=text-summary --coverageReporters=html
