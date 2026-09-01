-- Глобал «Правила редакции (VK-классификатор)» — vkEditorialRules.
--
-- Спутник к 20260901_131253_vk_editorial_rules.ts для ручного накатывания на
-- прод ДО мержа: `payload migrate` в CI зависает на drizzle y/N, поэтому гейт
-- деплоя падает на любой новой миграции, а DDL применяет человек (см.
-- .github/workflows/deploy-prod.yml → «Safety net»).
--
-- Правка ЧИСТО АДДИТИВНАЯ: две новые таблицы и два новых типа. Ни одной
-- существующей таблицы, колонки или связи не трогает, поэтому откат сводится к
-- DROP этих же объектов, а старый код продолжает работать и после накатывания —
-- порядок «сначала БД, потом деплой» здесь безопасен.
--
-- ПРИМЕНЕНО НА ПРОДЕ 2026-09-01 (batch 14, следующий за 13). Файл оставлен как
-- запись о том, что именно накатывали, и как образец для следующего раза.
--
-- Номер batch берётся из БД, а не из головы: `SELECT max(batch) FROM
-- payload_migrations` + 1. Локальная копия схемы, поднятая для проверки, имела
-- свой batch, и подставить его на прод было бы ошибкой.
--
-- Приёмка была не «команда выполнилась», а сверка с эталоном: колонки, типы,
-- умолчания и индексы прода сравнены с локальной базой, где ту же правку
-- сделал `payload migrate` — 18 колонок и 4 индекса совпали.
--
-- Применение (на будущее):
--   ssh GONBA 'sudo -u postgres psql -d gonba -v ON_ERROR_STOP=1' < <этот файл>
--   ssh GONBA "sudo -u postgres psql -d gonba -c \"INSERT INTO payload_migrations
--     (name, batch, updated_at, created_at) VALUES ('<имя>', <max+1>, now(), now());\""

CREATE TYPE "public"."enum_vk_editorial_rules_no_text_policy" AS ENUM('manual', 'source', 'skip');
CREATE TYPE "public"."enum__vk_editorial_rules_v_version_no_text_policy" AS ENUM('manual', 'source', 'skip');

CREATE TABLE "vk_editorial_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true,
	"rules" varchar,
	"no_text_policy" "enum_vk_editorial_rules_no_text_policy" DEFAULT 'manual',
	"min_text_length" numeric DEFAULT 40,
	"change_note" varchar,
	"updated_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone
);

CREATE TABLE "_vk_editorial_rules_v" (
	"id" serial PRIMARY KEY NOT NULL,
	"version_enabled" boolean DEFAULT true,
	"version_rules" varchar,
	"version_no_text_policy" "enum__vk_editorial_rules_v_version_no_text_policy" DEFAULT 'manual',
	"version_min_text_length" numeric DEFAULT 40,
	"version_change_note" varchar,
	"version_updated_at" timestamp(3) with time zone,
	"version_created_at" timestamp(3) with time zone,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "_vk_editorial_rules_v_created_at_idx" ON "_vk_editorial_rules_v" USING btree ("created_at");
CREATE INDEX "_vk_editorial_rules_v_updated_at_idx" ON "_vk_editorial_rules_v" USING btree ("updated_at");
