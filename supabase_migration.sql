-- Tabela de Leads
CREATE TABLE IF NOT EXISTS leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT,
    email TEXT,
    phone TEXT,
    source TEXT DEFAULT 'Indicação',
    status TEXT DEFAULT 'Novo Lead',
    responsible TEXT DEFAULT 'Ricardo Silveira',
    responsible_avatar TEXT,
    notes TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Política: Usuários podem ver apenas seus próprios leads
CREATE POLICY "Users can view their own leads" 
ON leads FOR SELECT 
USING (auth.uid() = user_id);

-- Política: Usuários podem inserir seus próprios leads
CREATE POLICY "Users can insert their own leads" 
ON leads FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Política: Usuários podem atualizar seus próprios leads
CREATE POLICY "Users can update their own leads" 
ON leads FOR UPDATE 
USING (auth.uid() = user_id);

-- Política: Usuários podem deletar seus próprios leads
CREATE POLICY "Users can delete their own leads" 
ON leads FOR DELETE 
USING (auth.uid() = user_id);

-- Tabela de Perfis de Usuário (Opcional, para metadados extras)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone" 
ON profiles FOR SELECT 
USING (true);

CREATE POLICY "Users can update their own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);
