.PHONY: admin-shell

admin-shell:
	@container_id=$$(docker-compose ps -q web); \
	if [ -z "$$container_id" ]; then \
		echo "Web container not found"; \
		exit 1; \
	else \
		docker exec -it $$container_id /bin/bash; \
	fi
