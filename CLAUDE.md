# Kanbanz

Kanban 100% front-end (HTML, CSS e JavaScript puro), com dados salvos no `localStorage`.
Não há build nem dependências: `index.html`, `app.js` e `style.css`.

Para rodar localmente:

```bash
python3 -m http.server 5173
```

## Fluxo de desenvolvimento

Siga estes passos sempre que for trabalhar em uma issue.

### 1. Criar a branch a partir da `main` atualizada

Antes de começar qualquer alteração:

```bash
git checkout main
git pull origin main
git checkout -b <tipo>/issue-<número>-<descricao-curta>
```

- `<tipo>`: `feat`, `fix` ou `chore` (mesmos tipos do commit, veja abaixo).
- `<número>`: número da issue no GitHub.
- `<descricao-curta>`: 2 a 5 palavras em kebab-case, minúsculas, sem acentos.

Exemplos:

- `feat/issue-123-change-color`
- `fix/issue-45-drag-drop-mobile`
- `chore/issue-78-update-readme`

Nunca faça commit direto na `main`.

### 2. Padrão de commit

```
<tipo>: <mensagem>
```

- `feat`: nova funcionalidade.
- `fix`: correção de bug.
- `chore`: manutenção, configuração, documentação, refatoração sem mudança de comportamento.

A mensagem fica no imperativo, curta (até ~72 caracteres) e com inicial minúscula.

Exemplos:

- `feat: add color picker to boards`
- `fix: keep task order after drag and drop`
- `chore: update CLAUDE.md workflow`

### 3. Pull request

Abra a PR da sua branch para a `main`. O título segue o padrão de commit (`<tipo>: <mensagem>`).

A descrição deve ser escrita **em português** e seguir exatamente este modelo:

```markdown
## 1. O que foi feito?

<Resumo das mudanças, em tópicos se houver mais de uma.>

## 2. Issue

Closes https://github.com/Vinicius-Tavares-Silva/kanbanz/issues/<número>
```

Use `Closes` antes do link para que a issue seja fechada automaticamente quando a PR for mergeada.
