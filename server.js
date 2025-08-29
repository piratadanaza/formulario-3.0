const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Conexão com PostgreSQL - PRIORIDADE para Railway
let poolConfig;

if (process.env.DATABASE_URL) {
    // Usa Railway (production)
    poolConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false // Necessário para Railway
        }
    };
    console.log('Configurando para Banco de Dados do Railway');
} else {
    // Fallback para local (desenvolvimento)
    poolConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASS || 'postgres',
        database: process.env.DB_NAME || 'formularioDB'
    };
    console.log('Configurando para Banco de Dados Local');
}

const pool = new Pool(poolConfig);

// Função para criar a tabela se não existir
async function criarTabela() {
    try {
        const query = `
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) NOT NULL UNIQUE,
                senha VARCHAR(255) NOT NULL,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        await pool.query(query);
        console.log('✅ Tabela verificada/criada com sucesso no Railway!');
        
        // Verificar se a tabela tem dados
        const result = await pool.query('SELECT COUNT(*) FROM usuarios');
        console.log(`📊 Total de usuários: ${result.rows[0].count}`);
    } catch (err) {
        console.error('❌ Erro ao criar tabela:', err.message);
    }
}

// Testar conexão e criar tabela
async function iniciarConexao() {
    try {
        const client = await pool.connect();
        
        if (process.env.DATABASE_URL) {
            console.log('✅ Conectado ao PostgreSQL no Railway!');
        } else {
            console.log('✅ Conectado ao PostgreSQL local!');
        }
        
        // Criar tabela se não existir
        await criarTabela();
        
        client.release();
    } catch (err) {
        console.error('❌ Erro ao conectar no banco:', err.message);
        
        if (process.env.DATABASE_URL) {
            console.log('⚠️  Verifique:');
            console.log('1. A connection string do Railway');
            console.log('2. Se o banco está ativo no Railway');
            console.log('3. As permissões de conexão');
        }
    }
}

// Iniciar conexão quando o servidor startar
iniciarConexao();

// Rota para salvar dados
app.post('/salvar', async (req, res) => {
    console.log('📨 Recebido:', req.body);
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).send('Email e senha são obrigatórios');
    }

    try {
        await pool.query(
            'INSERT INTO usuarios (email, senha) VALUES ($1, $2)',
            [email, senha]
        );
        console.log('💾 Dados salvos no Railway!');
        res.send('Dados salvos com sucesso!');
    } catch (err) {
        console.error('❌ Erro ao inserir:', err.message);
        if (err.code === '23505') {
            res.status(400).send('Email já cadastrado');
        } else {
            res.status(500).send('Erro ao salvar no banco');
        }
    }
});

// Listar usuários
app.get('/usuarios', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, email, data_criacao FROM usuarios ORDER BY id ASC');
        console.log(`📋 Listando ${result.rows.length} usuários do Railway`);
        res.json(result.rows);
    } catch (err) {
        console.error('❌ Erro ao buscar usuários:', err.message);
        res.status(500).send('Erro ao buscar no banco');
    }
});

// Excluir usuário
app.delete('/usuarios/:id', async (req, res) => {
    const { id } = req.params;
    console.log(`🗑️  Excluindo usuário ID: ${id}`);

    try {
        const result = await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            res.status(404).send('Usuário não encontrado');
        } else {
            console.log('✅ Usuário excluído do Railway');
            res.send('Usuário excluído com sucesso!');
        }
    } catch (err) {
        console.error('❌ Erro ao excluir usuário:', err.message);
        res.status(500).send('Erro ao excluir do banco');
    }
});

// Rota de health check
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ 
            status: 'OK', 
            database: 'Conectado',
            environment: process.env.NODE_ENV || 'development',
            platform: process.env.DATABASE_URL ? 'Railway' : 'Local',
            message: 'Dados sendo salvos no Railway!'
        });
    } catch (err) {
        res.status(500).json({ 
            status: 'ERROR', 
            database: 'Desconectado',
            error: err.message 
        });
    }
});

// Rota raiz
app.get('/', (req, res) => {
    res.json({
        message: 'Servidor funcionando!',
        database: process.env.DATABASE_URL ? 'Railway' : 'Local',
        status: 'OK'
    });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('🚀 Servidor rodando em http://localhost:' + PORT);
    console.log('🌐 Ambiente: ' + (process.env.NODE_ENV || 'development'));
    console.log('💾 Banco: ' + (process.env.DATABASE_URL ? 'Railway' : 'Local'));
    
    if (process.env.DATABASE_URL) {
        console.log('✅ Dados serão salvos no Railway!');
    } else {
        console.log('⚠️  Dados sendo salvos localmente');
    }
});