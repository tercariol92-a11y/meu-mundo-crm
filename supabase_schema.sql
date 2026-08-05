-- 1. Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tipos ENUM (Protegidos contra erros de repetição)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_usuario') THEN
        CREATE TYPE tipo_usuario AS ENUM ('admin', 'tecnico', 'cliente');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_chamado') THEN
        CREATE TYPE status_chamado AS ENUM ('aberto', 'em_atendimento', 'concluido', 'cancelado');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'prioridade_chamado') THEN
        CREATE TYPE prioridade_chamado AS ENUM ('baixa', 'media', 'alta', 'critica');
    END IF;
END $$;

-- 3. Criação de Tabelas

-- Tabela de Usuários (Perfil estendido do Auth)
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role tipo_usuario NOT NULL DEFAULT 'cliente',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Clientes
CREATE TABLE IF NOT EXISTS public.clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- 1. Dados da Empresa
    razao_social TEXT,
    nome_fantasia TEXT NOT NULL,
    cnpj TEXT UNIQUE,
    inscricao_estadual TEXT,
    inscricao_municipal TEXT,
    tipo_pessoa TEXT DEFAULT 'Jurídica',
    status TEXT DEFAULT 'Ativo',
    logo_url TEXT,
    
    -- 2. Contato Principal
    responsavel_nome TEXT,
    responsavel_cargo TEXT,
    telefone_fixo TEXT,
    celular_whatsapp TEXT,
    email_principal TEXT,
    email_financeiro TEXT,
    email_tecnico TEXT,
    
    -- 3. Endereço
    cep TEXT,
    rua TEXT,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT,
    pais TEXT DEFAULT 'Brasil',
    
    -- 4. Dados Comerciais
    origem_lead TEXT,
    vendedor_responsavel TEXT,
    segmento TEXT,
    observacoes_comerciais TEXT,
    possui_contrato BOOLEAN DEFAULT FALSE,
    contrato_numero TEXT,
    contrato_inicio DATE,
    contrato_vencimento DATE,
    contrato_valor_mensal NUMERIC(15,2),
    sla_atendimento TEXT,
    suporte_ativo BOOLEAN DEFAULT FALSE,
    
    -- 5. Equipamentos e Estrutura
    usa_equipamento BOOLEAN DEFAULT FALSE,
    equipamento_tipo TEXT,
    equipamento_marca TEXT,
    equipamento_modelo TEXT,
    equipamento_serie TEXT,
    equipamento_quantidade INTEGER DEFAULT 0,
    local_instalacao TEXT,
    possui_catraca BOOLEAN DEFAULT FALSE,
    possui_facial BOOLEAN DEFAULT FALSE,
    possui_ponto BOOLEAN DEFAULT FALSE,
    
    -- 6. Software e Integrações
    usa_software BOOLEAN DEFAULT FALSE,
    software_nome TEXT,
    software_tipo TEXT,
    software_origem TEXT,
    integra_senior BOOLEAN DEFAULT FALSE,
    integra_totvs BOOLEAN DEFAULT FALSE,
    integra_secullum BOOLEAN DEFAULT FALSE,
    integra_outro TEXT,
    observacoes_tecnicas TEXT,
    
    -- 7. Dados Financeiros
    forma_pagamento TEXT,
    dia_vencimento INTEGER,
    financeiro_responsavel TEXT,
    pagador_cpf_cnpj TEXT,
    banco TEXT,
    chave_pix TEXT,
    inadimplente BOOLEAN DEFAULT FALSE,
    
    -- 8. Observações Gerais
    observacoes_internas TEXT,
    historico_resumido TEXT,
    preferencias_atendimento TEXT,
    restricoes_tecnicas TEXT,

    usuario_id UUID REFERENCES public.usuarios(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Equipamentos do Cliente
CREATE TABLE IF NOT EXISTS public.equipamentos_cliente (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    nome TEXT,
    categoria TEXT,
    marca TEXT,
    modelo TEXT,
    numero_serie TEXT,
    quantidade INTEGER DEFAULT 1,
    local_instalacao TEXT,
    observacoes_tecnicas TEXT,
    data_instalacao DATE,
    status TEXT DEFAULT 'Ativo',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Unidades
CREATE TABLE IF NOT EXISTS public.unidades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    endereco TEXT,
    cidade TEXT,
    estado TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Técnicos
CREATE TABLE IF NOT EXISTS public.tecnicos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    especialidade TEXT,
    status TEXT DEFAULT 'disponivel',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Equipamentos
CREATE TABLE IF NOT EXISTS public.equipamentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    modelo TEXT,
    numero_serie TEXT UNIQUE,
    data_instalacao DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Chamados
CREATE TABLE IF NOT EXISTS public.chamados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES public.clientes(id),
    unidade_id UUID NOT NULL REFERENCES public.unidades(id),
    equipamento_id UUID REFERENCES public.equipamentos(id),
    tecnico_id UUID REFERENCES public.tecnicos(id),
    titulo TEXT NOT NULL,
    descricao TEXT,
    status status_chamado DEFAULT 'aberto',
    prioridade prioridade_chamado DEFAULT 'media',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Propostas / Orçamentos
CREATE TABLE IF NOT EXISTS public.propostas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    valor NUMERIC(15,2) DEFAULT 0,
    status TEXT DEFAULT 'rascunho', -- rascunho, enviada, aceita, recusada, cancelada
    data_envio TIMESTAMPTZ,
    data_aceite TIMESTAMPTZ,
    vendedor_id UUID REFERENCES public.usuarios(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Metas
CREATE TABLE IF NOT EXISTS public.metas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mes INTEGER NOT NULL,
    ano INTEGER NOT NULL,
    valor_objetivo NUMERIC(15,2) NOT NULL,
    tipo TEXT DEFAULT 'faturamento', -- faturamento, vendas, chamados
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mes, ano, tipo)
);

-- 4. Criação de Funções

-- Função para atualizar o updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Função para verificar se o usuário é admin (SECURITY DEFINER para evitar recursão no RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Fallback para o email do desenvolvedor principal
  IF auth.jwt() ->> 'email' = 'Tercariol92@gmail.com' THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Função para criar perfil de usuário automaticamente após o Auth SignUp
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.usuarios (id, nome, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.email,
        CASE 
            WHEN NEW.email = 'Tercariol92@gmail.com' THEN 'admin'::tipo_usuario
            ELSE COALESCE((NEW.raw_user_meta_data->>'role')::tipo_usuario, 'cliente')
        END
    )
    ON CONFLICT (id) DO UPDATE SET
        role = EXCLUDED.role,
        nome = EXCLUDED.nome;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Alterações com ALTER TABLE

-- Ajuste na Tabela de Chamados para Histórico Completo
ALTER TABLE public.chamados 
ADD COLUMN IF NOT EXISTS tipo_atendimento TEXT,
ADD COLUMN IF NOT EXISTS solucao_aplicada TEXT,
ADD COLUMN IF NOT EXISTS observacoes_tecnicas TEXT,
ADD COLUMN IF NOT EXISTS data_fechamento TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS equipamento_cliente_id UUID REFERENCES public.equipamentos_cliente(id);

-- 6. Criação de Triggers (Protegidos com DROP IF EXISTS)

-- Triggers de updated_at
DROP TRIGGER IF EXISTS update_usuarios_updated_at ON public.usuarios;
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON public.usuarios FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_clientes_updated_at ON public.clientes;
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_unidades_updated_at ON public.unidades;
CREATE TRIGGER update_unidades_updated_at BEFORE UPDATE ON public.unidades FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_tecnicos_updated_at ON public.tecnicos;
CREATE TRIGGER update_tecnicos_updated_at BEFORE UPDATE ON public.tecnicos FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_equipamentos_updated_at ON public.equipamentos;
CREATE TRIGGER update_equipamentos_updated_at BEFORE UPDATE ON public.equipamentos FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_chamados_updated_at ON public.chamados;
CREATE TRIGGER update_chamados_updated_at BEFORE UPDATE ON public.chamados FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_propostas_updated_at ON public.propostas;
CREATE TRIGGER update_propostas_updated_at BEFORE UPDATE ON public.propostas FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_metas_updated_at ON public.metas;
CREATE TRIGGER update_metas_updated_at BEFORE UPDATE ON public.metas FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_equipamentos_cliente_updated_at ON public.equipamentos_cliente;
CREATE TRIGGER update_equipamentos_cliente_updated_at BEFORE UPDATE ON public.equipamentos_cliente FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Trigger de criação de usuário
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Garantir que o usuário atual (Tercariol92@gmail.com) seja admin se já existir no auth.users
DO $$
DECLARE
    user_id UUID;
BEGIN
    SELECT id INTO user_id FROM auth.users WHERE email = 'Tercariol92@gmail.com' LIMIT 1;
    IF user_id IS NOT NULL THEN
        INSERT INTO public.usuarios (id, nome, email, role)
        VALUES (user_id, 'Admin Principal', 'Tercariol92@gmail.com', 'admin')
        ON CONFLICT (id) DO UPDATE SET role = 'admin';
    END IF;
END $$;

-- Migração: Garantir que todos os usuários do Auth tenham um perfil em public.usuarios
-- Isso resolve problemas de chave estrangeira se o trigger falhou anteriormente
INSERT INTO public.usuarios (id, nome, email, role)
SELECT 
    id, 
    COALESCE(raw_user_meta_data->>'full_name', email), 
    email, 
    CASE 
        WHEN email = 'Tercariol92@gmail.com' THEN 'admin'::tipo_usuario 
        ELSE 'cliente'::tipo_usuario 
    END
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- 7. Habilitação de RLS

ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipamentos_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tecnicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chamados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

-- 8. Criação de Policies (Protegidas e Robustas)

-- Limpar policies existentes para evitar erros de duplicidade ao rodar o script novamente
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.tablename);
    END LOOP;
END $$;

-- Políticas para Usuarios
CREATE POLICY "Admins acessam todos os usuários" ON public.usuarios FOR ALL TO authenticated 
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Usuários veem seu próprio perfil" ON public.usuarios FOR SELECT TO authenticated USING (id = auth.uid());

-- Políticas para Unidades
CREATE POLICY "Admins acessam todas as unidades" ON public.unidades FOR ALL TO authenticated 
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Usuários inserem unidades para seus clientes" ON public.unidades FOR INSERT TO authenticated 
WITH CHECK (cliente_id IN (SELECT id FROM public.clientes WHERE usuario_id = auth.uid()));

CREATE POLICY "Usuários atualizam unidades de seus clientes" ON public.unidades FOR UPDATE TO authenticated 
USING (cliente_id IN (SELECT id FROM public.clientes WHERE usuario_id = auth.uid()) OR public.is_admin());

CREATE POLICY "Clientes veem suas unidades" ON public.unidades FOR SELECT TO authenticated 
USING (cliente_id IN (SELECT id FROM public.clientes WHERE usuario_id = auth.uid()) OR public.is_admin());

-- Políticas para Equipamentos
CREATE POLICY "Admins acessam todos os equipamentos" ON public.equipamentos FOR ALL TO authenticated 
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Usuários veem equipamentos de suas unidades" ON public.equipamentos FOR SELECT TO authenticated 
USING (unidade_id IN (SELECT id FROM public.unidades WHERE cliente_id IN (SELECT id FROM public.clientes WHERE usuario_id = auth.uid())) OR public.is_admin());

-- Políticas para Clientes
CREATE POLICY "Admins acessam todos os clientes" ON public.clientes FOR ALL TO authenticated 
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Usuários inserem seus próprios clientes" ON public.clientes FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuários atualizam seus próprios clientes" ON public.clientes FOR UPDATE TO authenticated 
USING (auth.uid() = usuario_id OR public.is_admin());

CREATE POLICY "Clientes veem seus próprios dados" ON public.clientes FOR SELECT TO authenticated 
USING (usuario_id = auth.uid() OR public.is_admin());

-- Políticas para Chamados
CREATE POLICY "Admins acessam todos os chamados" ON public.chamados FOR ALL TO authenticated 
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Técnicos veem chamados atribuídos" ON public.chamados FOR SELECT TO authenticated 
USING (tecnico_id IN (SELECT id FROM public.tecnicos WHERE usuario_id = auth.uid()));

CREATE POLICY "Clientes veem seus próprios chamados" ON public.chamados FOR SELECT TO authenticated 
USING (cliente_id IN (SELECT id FROM public.clientes WHERE usuario_id = auth.uid()));

-- Políticas para Propostas
CREATE POLICY "Admins acessam todas as propostas" ON public.propostas FOR ALL TO authenticated 
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Vendedores veem suas propostas" ON public.propostas FOR SELECT TO authenticated 
USING (vendedor_id = auth.uid());

CREATE POLICY "Clientes veem suas propostas" ON public.propostas FOR SELECT TO authenticated 
USING (cliente_id IN (SELECT id FROM public.clientes WHERE usuario_id = auth.uid()));

-- Políticas para Metas
CREATE POLICY "Admins acessam todas as metas" ON public.metas FOR ALL TO authenticated 
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Todos veem metas" ON public.metas FOR SELECT TO authenticated 
USING (TRUE);

-- Políticas para Equipamentos do Cliente
CREATE POLICY "Admins acessam todos os equipamentos do cliente" ON public.equipamentos_cliente FOR ALL TO authenticated 
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Usuários inserem equipamentos para seus clientes" ON public.equipamentos_cliente FOR INSERT TO authenticated 
WITH CHECK (cliente_id IN (SELECT id FROM public.clientes WHERE usuario_id = auth.uid()));

CREATE POLICY "Usuários atualizam equipamentos de seus clientes" ON public.equipamentos_cliente FOR UPDATE TO authenticated 
USING (cliente_id IN (SELECT id FROM public.clientes WHERE usuario_id = auth.uid()) OR public.is_admin());

CREATE POLICY "Clientes veem seus equipamentos" ON public.equipamentos_cliente FOR SELECT TO authenticated 
USING (cliente_id IN (SELECT id FROM public.clientes WHERE usuario_id = auth.uid()) OR public.is_admin());

-- 9. Views de Compatibilidade
CREATE OR REPLACE VIEW public.clients AS SELECT * FROM public.clientes;

-- Exemplos de Uso (Comentado)
/*
-- Inserir um cliente manualmente
INSERT INTO public.clientes (nome_fantasia, razao_social, cnpj, email_principal, telefone_fixo, celular_whatsapp)
VALUES ('Mundo Tech', 'Mundo Tech Equipamentos LTDA', '12.345.678/0001-90', 'contato@mundotech.com', '(11) 3333-3333', '(11) 99999-9999');

-- Criar um chamado
INSERT INTO public.chamados (cliente_id, unidade_id, titulo, descricao, prioridade)
VALUES (
    'ID_DO_CLIENTE',
    'ID_DA_UNIDADE',
    'Catraca Travada',
    'A catraca da entrada principal não está liberando o acesso.',
    'alta'
);
*/
