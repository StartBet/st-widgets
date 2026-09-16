import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const allowedPrefixes = [
  'feature/',
  'feat/',
  'fix/',
  'hotfix/',
  'chore/',
  'refactor/',
  'perf/',
  'docs/',
  'test/',
  'ci/',
  'style/'
];

const suggestedName = 'feat/nome-da-sua-branch';

const fail = (lines) => {
  lines.forEach((line) => console.error(line));
  process.exit(1);
};

const resolveGitDir = () => {
  const dotGitPath = resolve(process.cwd(), '.git');

  if (statSync(dotGitPath).isDirectory()) return dotGitPath;

  const pointer = readFileSync(dotGitPath, 'utf8').trim();
  const prefix = 'gitdir:';

  if (!pointer.startsWith(prefix)) {
    throw new Error('Nao foi possivel localizar o diretorio do Git.');
  }

  return resolve(dirname(dotGitPath), pointer.slice(prefix.length).trim());
};

const currentBranch = () => {
  const head = readFileSync(resolve(resolveGitDir(), 'HEAD'), 'utf8').trim();
  const prefix = 'ref: refs/heads/';

  return head.startsWith(prefix) ? head.slice(prefix.length) : 'HEAD';
};

const invalidBranchMessage = (branchName) => [
  '',
  'Erro: o nome da branch nao segue o padrao esperado.',
  `Branch atual: ${branchName}`,
  '',
  'Prefixos permitidos:',
  ...allowedPrefixes.map((prefix) => `- ${prefix}`),
  '',
  'Exemplo valido:',
  `- ${suggestedName}`,
  '',
  'Como corrigir mantendo seus commits:',
  `1. git branch -m ${suggestedName}`,
  '2. git branch --show-current',
  `3. git push -u origin ${suggestedName}`,
  ''
];

try {
  const branchName = currentBranch();

  if (branchName === 'HEAD') {
    fail(['Aviso: repositorio em detached HEAD. Push bloqueado.']);
  }

  if (!allowedPrefixes.some((prefix) => branchName.startsWith(prefix))) {
    fail(invalidBranchMessage(branchName));
  }
} catch (error) {
  fail([
    'Erro ao validar o nome da branch.',
    error instanceof Error ? error.message : String(error)
  ]);
}
