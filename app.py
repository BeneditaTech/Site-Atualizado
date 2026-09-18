# jwt_required() significa que só usuários logados podem acessar aquela aba

# Importando as ferramentas do Flask (Cria, pega os dados e transforma em Json)
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
# Importado JWT
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
# Importando o Banco de dados
import datetime
import firebase_admin
from firebase_admin import credentials, firestore

# Criando o servidor
app = Flask(__name__)
CORS(app)

# Configurando a chave secreta de token 
app.config['JWT_SECRET_KEY'] = 'minha-chave-secreta'

# iniciando o JWT
jwt = JWTManager(app)

# Conectando ao Banco de Dados
if not firebase_admin._apps:
    cred = credentials.Certificate('plataformatech-firebase-adminsdk-fbsvc-698da36c86.json')
    firebase_admin.initialize_app(cred)
db = firestore.client()

print("Firebase conectado!")

# Aba Inicial Navegador GET
@app.route('/')
def home():
    return render_template('index.html')

# Criando o endereço de Cadastro POST
@app.route('/cadastro', methods=['POST'])
def cadastrar():
    # Pegando os dados enviados 
    dados = request.get_json()

    nome = dados['nome']
    email = dados['email']
    senha = dados['senha']

    usuario ={
        'nome':nome,
        'email':email,
        'senha':senha,
        'selos':[],
        'data_cadastro':datetime.datetime.now(datetime.timezone.utc)
    }

    db.collection('usuarios').add(usuario)

    # Desenvolvendo a resposta de sucesso (return)
    return jsonify({'mensagem':'Aluno cadastrado!'}), 201

# Criando o endereço de login POST
@app.route('/login', methods=['POST'])
def login():
    try:
        dados = request.get_json()

        email = dados['email']
        senha = dados['senha']

        # Procura o usuário pelo e-mail
        usuarios = db.collection('usuarios')\
                     .where('email', '==', email)\
                     .limit(1)\
                     .stream()

        usuario_encontrado = None

        for usuario in usuarios:
            usuario_encontrado = usuario.to_dict()
            break

        # Usuário não encontrado
        if usuario_encontrado is None:
            return jsonify({'erro': 'E-mail ou senha incorretos'}), 401

        # Confere a senha
        if usuario_encontrado['senha'] != senha:
            return jsonify({'erro': 'E-mail ou senha incorretos'}), 401

        # Cria o token JWT
        token = create_access_token(identity=email)

        return jsonify({
            'mensagem': 'Login realizado com sucesso!',
            'token': token
        }), 200

    except Exception as e:
        return jsonify({'erro': str(e)}), 500
    
# Criando o endereço de Perfil GET
@app.route('/perfil', methods=['GET'])
def perfil():
    return render_template('perfil.html')

# Criando a listagem de Matérias
@app.route('/materias', methods=['GET'])
@jwt_required()
def listar_materias():
    materias = {
        "fundamental": [ # 6° ao 9°
            {"id": "matematica", "nome": "Matemática"},
            {"id": "portugues", "nome": "Língua Portuguesa"},
            {"id": "historia", "nome": "História"},
            {"id": "geografia", "nome": "Geografia"},
            {"id": "ciencias", "nome": "Ciências"},
            {"id": "ingles", "nome": "Língua inglesa"},
            {"id": "artes", "nome": "Artes"},
            {"id": "educacao_fisica", "nome": "Educação Física"},
            {"id": "tecnologia", "nome": "Tecnologia e Inovação"},
            {"id": "educacao_financeira", "nome": "Educação Financeira"},
            {"id": "projeto_de_vida", "nome": "Projeto de Vida"},
        ],
        "medio": [ # 1° ao 3°
            {"id": "portugues", "nome": "Língua Portuguesa"},
            {"id": "redacao", "nome": "Redação e Leitura"},
            {"id": "matematica", "nome": "Matemática"},
            {"id": "educacao_financeira", "nome": "Educação Financeira"},
            {"id": "fisica", "nome": "Física"},
            {"id": "quimica", "nome": "Química"},
            {"id": "biologia", "nome": "Biologia"},
            {"id": "historia", "nome": "História"},
            {"id": "geografia", "nome": "Geografia"},
            {"id": "filosofia", "nome": "Filosofia"},
            {"id": "sociologia", "nome": "Sociologia"},
            {"id": "ingles", "nome": "Língua Inglesa"},
            {"id": "artes", "nome": "Artes"},
            {"id": "educacao_fisica", "nome": "Educação Física"},
            {"id": "projeto_de_vida", "nome": "Projeto de Vida"},
        ],
        "tecnico_ciencia_de_dados": [
            {"id": "aprendizado_maquina", "nome": "Aprendizado de Máquina"},
            {"id": "matematica_estatistica", "nome": "Matemática e Estatística para Ciência de Dados"},
            {"id": "analise_exploratoria", "nome": "Análise Exploratória de Dados e Inteligência de Negócios"},
            {"id": "inteligencia_artificial", "nome": "Inteligência Artificial"},
            {"id": "banco_dados_nuvem", "nome": "Banco de Dados e Computação em Nuvem"},
            {"id": "etica_ia", "nome": "Ética e Responsabilidade em IA"},
            {"id": "projeto_multidisciplinar", "nome": "Projeto Multidisciplinar em Ciência de Dados"},
            {"id": "carreira", "nome": "Carreira"},
            {"id": "introducao_informatica", "nome": "Introdução à Informática"},
            {"id": "programacao_aplicada", "nome": "Programação Aplicada"},
            {"id": "planilhas_eletronicas", "nome": "Planilhas Eletrônicas"},
        ]
    }
    return jsonify(materias), 200

# Criando o endereço de post TEXTO GET 
@app.route('/postar', methods=['POST'])
@jwt_required()
def criar_post():

    try:
        # Pegando os dados enviados 
        dados = request.get_json()
        texto = dados.get('texto')    
        materia = dados.get('materia')

        # Validação básica
        if not texto or not materia:
            return jsonify({'erro': 'Texto e matéria são obrigatórios'}), 400
    
        # Pegando o ID do usuário logado pelo token JWT
        autor_id = get_jwt_identity()

        # Montando o documento para salvar
        novo_post = {
            'texto': texto,
            'materia': materia,
            'autor_id': autor_id,
            'data_criacao': datetime.datetime.now(datetime.timezone.utc)
        }
    
        # Salvando no Firestore
        db.collection("posts").add(novo_post)

        # Devolvendo confirmação
        return jsonify({'mensagem': 'Post criado com sucesso!'}), 201

    except Exception as e:
        return jsonify({'erro': str(e)}), 500

# Criando o endereço de publicação de artigos
@app.route('/pesquisar-artigos', methods=['GET'])
@jwt_required()
def publicar_arquivos():
    artigos = []

    # busca todos os documentos da coleção "posts"
    posts = db.collection("posts").stream()

    for post in posts:
        dados = post.to_dict() # Converte para dicionario Python
        dados['id'] = post.id # inclui o ID do documento
        artigos.append(dados) # Adiciona na lista
    
    return jsonify(artigos), 200 # Mostra o arquivo em Json

# Criando o endereço de pesquisa de artigos
@app.route('/postar-artigos', methods=['GET'])
@jwt_required()
def pesquisar_artigos():
    materia_id = request.args.get('materia_id')  # agora usa o id da matéria

    if not materia_id:
        return jsonify({"erro": "Informe uma matéria"}), 400

    try:
        artigos = []

        posts = db.collection("posts")\
                  .where("materia", "==", materia_id)\
                  .stream()

        for post in posts:
            dados = post.to_dict()
            dados['id'] = post.id
            artigos.append(dados)

        if not artigos:
            return jsonify({"mensagem": "Nenhum artigo encontrado"}), 404

        return jsonify(artigos), 200

    except Exception as e:
        return jsonify({"erro": str(e)}), 500

# Criando o endereço de publicação na agenda 
@app.route('/salvar-anotacao', methods=['POST'])
@jwt_required()
def salvar_anotacao():
    try:
        # Pegando os dados enviados 
        dados = request.get_json()
        texto = dados.get('texto')
        materia = dados.get('materia')

        # Validação básica
        if not texto or not materia:
            return jsonify({'erro': 'Texto e matéria são obrigatórios'}), 400

        # Pegando ID do usuário logado pelo token JWT
        autor_id = get_jwt_identity()

        # Montando o documneto para salvar
        nova_anotacao = {
            'texto': texto,
            'materia': materia,
            'autor_id': autor_id,
            'data_criacao': datetime.datetime.now(datetime.timezone.utc)
        }

        # Salvando no Firestore na coleção "agenda"
        db.collection("agenda").add(nova_anotacao)

        return jsonify({'mensagem': 'Anotação salva com sucesso'}), 201

    except Exception as e:
        return jsonify({'erro': str(e)}), 500 

# Criando o endereço de busca na agenda
@app.route('/busca-na-agenda', methods=['GET']
)
@jwt_required()
def buscar_anotacoes():
    try:
        # Pega o ID do usuário logado
        autor_id = get_jwt_identity()
        anotacoes = []

        # Busca só as anotações do usuário logado
        docs = db.collection("agenda")\
            .where("autor_id", "==", autor_id)\
            .stream()

        # Convertendo cada documento para dict e add na lista 
        for doc in docs:
            dados = doc.to_dict()
            dados['id'] = doc.id
            anotacoes.append(dados)

        return jsonify(anotacoes), 200

    except Exception as e:
        return jsonify({'erro': str(e)}), 500

# Criando o endereço de deletar na agenda
@app.route('/agenda/<id>', methods=['DELETE'])
@jwt_required()
def deletar_anotacao(id):
    try:
        # Pegando o ID do usuário logado
        autor_id = get_jwt_identity()

        # Busca a anotação pelo ID no Firestore
        doc = db.collection("agenda").document(id).get()

        # Verifica se a anotação existe
        if not doc.exists:
            return jsonify({'erro': 'Anotação não encontrada'}), 404

        # Verifica se a anotação pertence ao usuário logado
        if doc.to_dict()['autor_id'] != autor_id:
            return jsonify({'erro': 'Você não tem permissão para deletar essa anotação.'}), 403

        #Deleta a anotação do Firestore
        db.collection("agenda").document(id).delete()

        return jsonify({'mensagem': 'Anotação deletada com sucesso!'}), 200

    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@app.route('/post/<id>', methods=['DELETE'])
@jwt_required()
def deletar_post(id):
    try:
        autor_id = get_jwt_identity()

        doc = db.collection("posts").document(id).get()

        if not doc.exists:
            return jsonify({'erro': 'Post não encontrado'}), 404

        if doc.to_dict()['autor_id'] != autor_id:
            return jsonify({'erro': 'Você não tem permissão para deletar esse post'}), 403

        db.collection("posts").document(id).delete()

        return jsonify({'mensagem': 'Post deletado com sucesso!'}), 200

    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@app.route('/forum/pergunta', methods=['POST'])
@jwt_required()
def criar_pergunta():
    try:
        dados = request.get_json()

        pergunta = dados.get('pergunta')

        if not pergunta:
            return jsonify({'erro': 'Digite uma pergunta'}), 400

        usuario = get_jwt_identity()

        nova_pergunta = {
            'pergunta': pergunta,
            'autor_id': usuario,
            'data_criacao': datetime.datetime.now(datetime.timezone.utc)
        }

        db.collection("forum").add(nova_pergunta)

        return jsonify({'mensagem': 'Pergunta criada com sucesso!'}), 201

    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@app.route('/forum/perguntas', methods=['GET'])
@jwt_required()
def listar_perguntas():
    try:
        perguntas = []

        docs = db.collection("forum").stream()

        for doc in docs:
            dados = doc.to_dict()
            dados['id'] = doc.id
            perguntas.append(dados)

        return jsonify(perguntas), 200

    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@app.route('/forum/responder/<pergunta_id>', methods=['POST'])
@jwt_required()
def responder_pergunta(pergunta_id):
    try:
        dados = request.get_json()

        resposta = dados.get('resposta')

        if not resposta:
            return jsonify({'erro': 'Digite uma resposta'}), 400

        usuario = get_jwt_identity()

        nova_resposta = {
            'pergunta_id': pergunta_id,
            'resposta': resposta,
            'autor_id': usuario,
            'data_criacao': datetime.datetime.now(datetime.timezone.utc)
        }

        db.collection("respostas").add(nova_resposta)

        return jsonify({'mensagem': 'Resposta enviada com sucesso!'}), 201

    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@app.route('/post/<id>', methods=['PUT'])
@jwt_required()
def editar_post(id):
    try:
        autor_id = get_jwt_identity()

        dados = request.get_json()
        novo_texto = dados.get('texto')
        nova_materia = dados.get('materia')

        doc = db.collection("posts").document(id).get()

        if not doc.exists:
            return jsonify({'erro': 'Post não encontrado'}), 404

        if doc.to_dict()['autor_id'] != autor_id:
            return jsonify({'erro': 'Você não pode editar esse post'}), 403

        db.collection("posts").document(id).update({
            'texto': novo_texto,
            'materia': nova_materia
        })

        return jsonify({'mensagem': 'Post editado com sucesso!'}), 200

    except Exception as e:
        return jsonify({'erro': str(e)}), 500

@app.route('/teste-firebase')
def teste_firebase():
    db.collection("teste").document("conexao").set({
        "status": "Funcionando",
        "mensagem": "Flask conectado ao Firebase"
    })

    return jsonify({
        "mensagem": "Firebase funcionando!"
    }), 200

# Ligando o sevidor
if __name__ =='__main__':
    app.run(debug=True)