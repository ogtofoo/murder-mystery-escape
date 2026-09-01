.PHONY: help up down restart logs console cmd status backup restore shell pull

help:
	@echo "make up       - start the server (detached)"
	@echo "make down     - stop and remove the container"
	@echo "make restart  - restart the server"
	@echo "make logs     - follow server logs"
	@echo "make console  - attach to the BDS console (detach with Ctrl-P Ctrl-Q)"
	@echo "make cmd C='say hi' - send one console command"
	@echo "make status   - show container state"
	@echo "make backup   - snapshot the world to ./backups/"
	@echo "make pull     - pull a newer server image"

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f bedrock

# Ctrl-P Ctrl-Q detaches WITHOUT killing the server. Ctrl-C would stop it.
console:
	docker attach mystery-bedrock

cmd:
	@test -n "$(C)" || { echo "Usage: make cmd C='gamerule showcoordinates true'"; exit 1; }
	docker exec mystery-bedrock send-command $(C)

status:
	docker compose ps

backup:
	./scripts/backup.sh

restore:
	@test -n "$(F)" || { echo "Usage: make restore F=backups/xxx.tar.gz"; exit 1; }
	./scripts/restore.sh $(F)

shell:
	docker exec -it mystery-bedrock bash

pull:
	docker compose pull && docker compose up -d
