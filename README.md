# Organizador do Sucesso

Ferramenta local para organizar rotina, tarefas e metas com tres etapas principais:

- `Ideias`
- `Execucao`
- `Finalizada`
- `Agenda`

Os dados sao salvos em banco SQLite para permitir acompanhamento de progresso por tabela, visoes graficas no dashboard e lembretes persistentes na agenda.

## Como rodar

```bash
npm install
npm start
```

Depois, abra:

```text
http://localhost:3000
```

Se a porta `3000` ja estiver em uso, a aplicacao agora tenta automaticamente a proxima porta livre, como `3001`, `3002` e assim por diante. Veja no terminal o endereco exibido ao iniciar.

Se preferir definir a porta manualmente no PowerShell:

```powershell
$env:PORT=3001
npm start
```

Depois abra:

```text
http://localhost:3001
```

## O que a ferramenta faz

- Cadastra tarefas, objetivos e categorias
- Controla status entre ideias, execucao e finalizada
- Permite criar subtarefas em checklist dentro de cada tarefa
- Registra data de inicio e data de fim das tarefas
- Calcula o tempo de desenvolvimento de cada atividade
- Mantem uma agenda com lembretes que so desaparecem quando voce exclui manualmente
- Calcula progresso com base em valor atual e meta total
- Mostra cards com indicadores gerais
- Exibe grafico de distribuicao por status
- Exibe grafico de evolucao das metas
- Mostra tabela de desempenho por objetivo

## Persistencia

- Os dados cadastrados permanecem no banco quando a aplicacao e reiniciada
- Nenhuma tarefa ou lembrete e apagado automaticamente
- Exclusoes so acontecem quando voce confirma manualmente na interface

## Banco de dados

Por padrao, o banco SQLite fica salvo em:

```text
%LOCALAPPDATA%\OrganizadorDoSucesso\organizador.db
```

Esse e o banco ativo usado pela aplicacao ao executar `npm start`.

Se quiser, voce pode definir outro local com a variavel:

```text
ORGANIZADOR_DATA_DIR
```

Observacoes importantes:

- A pasta local `data/` do projeto esta no `.gitignore` e nao e o local padrao do banco em execucao.
- Se existir um arquivo `.db` dentro de `data/`, trate-o como um banco antigo, de teste ou copia local, a menos que voce tenha definido `ORGANIZADOR_DATA_DIR` apontando para essa pasta.
