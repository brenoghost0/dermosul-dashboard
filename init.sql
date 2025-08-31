-- init.sql
-- Schema e dados iniciais para o banco de dados Dermosul (PostgreSQL)

-- Bloco para garantir que o usuário 'user' exista.
-- Esta é uma medida de segurança para contornar problemas de inicialização do Docker.
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'user') THEN

      CREATE ROLE "user" WITH LOGIN PASSWORD 'password';
   END IF;
END
$do$;

-- Tabela de usuários para autenticação
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Em um app real, use bcrypt ou argon2
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de pedidos, o coração do dashboard
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_date DATE NOT NULL,
    category VARCHAR(100) NOT NULL,
    total_value NUMERIC(10, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    client_name VARCHAR(255),
    converted BOOLEAN DEFAULT TRUE
);

-- Garante que o usuário 'user' tenha todas as permissões no banco 'dermosul'
-- NOTA: O banco de dados 'dermosul' é criado pelo entrypoint do Docker via env var.
-- Este script roda dentro do banco 'dermosul', então podemos conceder as permissões.
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "user";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "user";


-- Inserir um usuário padrão para login
INSERT INTO users (name, email, password_hash)
VALUES ('Admin Dermosul', 'admin@dermosul.com', '$2b$10$fakedisplayhashfortesting123')
ON CONFLICT (email) DO NOTHING;

-- Popular com dados fictícios dos últimos 14 dias
INSERT INTO orders (order_date, category, total_value, payment_method, client_name)
SELECT
    gs.d AS order_date,
    (
        CASE (floor(random() * 5))
            WHEN 0 THEN 'Skincare'
            WHEN 1 THEN 'Higiene'
            WHEN 2 THEN 'Cabelo'
            WHEN 3 THEN 'Solares'
            ELSE 'Maquiagem'
        END
    ) AS category,
    (100 + floor(random() * 900) * (1 + (gs.d - CURRENT_DATE) / 14.0))::numeric(10,2) AS total_value,
    (
        CASE (floor(random() * 4))
            WHEN 0 THEN 'Pix'
            WHEN 1 THEN 'Cartão de Crédito'
            WHEN 2 THEN 'Boleto'
            ELSE 'Débito'
        END
    ) AS payment_method,
    'Cliente ' || (100 + floor(random() * 900))::text AS client_name
FROM (
    SELECT CURRENT_DATE - i AS d
    FROM generate_series(0, 13) AS i
) AS gs
CROSS JOIN generate_series(1, 15 + floor(random() * 20)::int);
