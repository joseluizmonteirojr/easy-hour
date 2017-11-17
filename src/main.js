'use strict';

const defaults = require('../config.json');
const colors = require('colors');

const yargs = require('yargs')
    .usage('$0 [args]')
    .option('yes', {
      alias: 'y',
      describe: 'Não pergunta se deseja confirmar',
      default: false
    })
    .option('host', {
      describe: 'Endereço do redmine',
      default: defaults.host
    })
    .option('quiet', {
      alias: 'q',
      describe: 'Não exibe nenhuma mensagem',
      default: false
    })
    .option('user', {
      alias: 'u',
      describe: 'Código de usuário do redmine',
      default: defaults.user
    })
    .option('time', {
      alias: 't',
      describe: 'Tempo a ser registrado na tarefa',
      default: defaults.time
    })
    .option('api-key', {
      alias: 'k',
      describe: 'Código de autenticação do redmine',
      default: defaults['api-key']
    }).option('issue_id', {
      alias: 'c',
      describe: 'Número do chamado no Redmine',
    })
    .help('h')
    .argv;

const EM_DESENVOLVIMENTO = 9;
const MAX_BACKWARD = 7;
const TODAY = new Date().toISOString().substr(0, 10);

const redmine = require('./redmine')
  .host(yargs.host)
  .apiKey(yargs['api-key']);

Promise.all([
  getCurrent(),
  getTodayTasks({'assigned_to_id': yargs.user})
])
  .then(([reuniao, todayIssues]) => {
    var today = todayIssues.map(issue => `#${issue.id} - ${issue.subject}`);
    var notes = `*Hoje*:\n${today.join('\n')}\n`;

    log(`${notes}`);

    return confirm().then(() => submit(reuniao, notes));
  })
  .then(response => log('\n\n--\n\n*** Salvo com sucesso! ***'))
  .catch(error => error && console.error(colors.red(`\n\nErro: ${error}\n`)));

function log(...args) {
  if ( !yargs.quiet )
    console.log.apply(console, args);
}

function confirm() {
  return new Promise((resolve, reject) => {
    if ( yargs.yes )
      return resolve();

    const input = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    input.question('\n\n--\n\nDeseja enviar (Y/n) ? ', function(response) {
      if ( ['', 'Y', 'y', 'yes', 'Yes'].indexOf(response) >= 0 )
        resolve();
      else
        reject();
      input.close();
    });
  });
}

function getTodayTasks(qs = {}) {
  return redmine.queryIssues(Object.assign({'status_id': EM_DESENVOLVIMENTO}, qs))
    .then(andamento => {
      if ( andamento.length > 0 )
        return shuffleArray(andamento).slice(0, 2);
    });
}

function getCurrent(qs = {}) {
  return redmine.queryIssues(Object.assign({
    'status_id': EM_DESENVOLVIMENTO,
    'assigned_to_id': yargs.user
  }, qs)).then(issues => {
    var length = issues.length;
    if (length !== 1 && !yargs.issue_id)
      throw `existem ${length} tarefas abertas`;

    return issues[0];
  });
}

function submit(issue, notes) {
  return Promise.all([
    /*redmine.updateIssue(issue.id, {notes}),*/
    redmine.createTimeEntry({
      'hours': yargs.time,
      'activity_id': 16,
      'issue_id': (yargs.issue_id) ? yargs.issue_id : issue.id  ,
      'spent_on': TODAY,
      'user_id': yargs.user
    })
  ]);
}

/**
 * Randomize array element order in-place.
 * Using Durstenfeld shuffle algorithm.
 */
function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}
