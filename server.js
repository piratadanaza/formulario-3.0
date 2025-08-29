const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Conexão com PostgreSQL usando a connection string do Railway
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:RQnoOxMiQWlJzdtbEEDDsWOmGhuNHWvE@yamanote.proxy.rlwy.net:10004/railway';

const pool = new Pool({
    connectionString: connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

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
        console.log('Tabela verificada/criada com sucesso!');
        
        // Verificar se a tabela tem dados
        const result = await pool.query('SELECT COUNT(*) FROM usuarios');
        console.log(`Total de usuários na tabela: ${result.rows[0].count}`);
    } catch (err) {
        console.error('Erro ao criar tabela:', err);
    }
}

// Testar conexão e criar tabela
async function iniciarConexao() {
    try {
        const client = await pool.connect();
        console.log('Conectado ao PostgreSQL no Railway!');
        
        // Criar tabela se não existir
        await criarTabela();
        
        client.release();
    } catch (err) {
        console.error('Erro ao conectar no banco:', err.stack);
    }
}

// Iniciar conexão quando o servidor startar
iniciarConexao();

// Rota para salvar dados
app.post('/salvar', async (req, res) => {
    console.log('Recebido:', req.body);
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).send('Email e senha são obrigatórios');
    }

    try {
        await pool.query(
            'INSERT INTO usuarios (email, senha) VALUES ($1, $2)',
            [email, senha]
        );
        res.send('Dados salvos com sucesso!');
    } catch (err) {
        console.error('Erro ao inserir:', err);
        if (err.code === '23505') { // Código de erro para unique violation
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
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar usuários:', err);
        res.status(500).send('Erro ao buscar no banco');
    }
});

// Excluir usuário
app.delete('/usuarios/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            res.status(404).send('Usuário não encontrado');
        } else {
            res.send('Usuário excluído com sucesso!');
        }
    } catch (err) {
        console.error('Erro ao excluir usuário:', err);
        res.status(500).send('Erro ao excluir do banco');
    }
});

// Rota de health check
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'OK', database: 'Conectado' });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', database: 'Desconectado' });
    }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});