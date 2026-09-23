import { Chess } from 'chess.js';

const WHITE_PATTERN = [
  'Qe2','Qg2','Rh3','Rf3','Qg4','Rf5','Qg6','Rf6','Qg7','Qf8',
  'Rd6','Rd8','Qe7','Rd6','Qc7','Rd2','Rh2','Rh1','Qd6','Qd1#'
];
const BLACK_PATTERN = [
  'Qe7','Qg7','Rh6','Rf6','Qg5','Rf4','Qg3','Rf3','Qg2','Qf1',
  'Rd3','Rd1','Qe2','Rd3','Qc2','Rd7','Rh7','Rh8','Qd3','Qd8#'
];
const WHITE_BACKRANK = ['R','N','B','Q','K','B','N','R'];
const BLACK_BACKRANK = ['r','n','b','q','k','b','n','r'];
const pieceGlyph = {
  w:{k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙'},
  b:{k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'}
};

let game = new Chess();
let orientation = 'w';
let selected = null;
let legalTargets = [];
let trainerIndex = 0;
let trainerBoard = null;
let trainerLine = [];
let engine = null;
let engineReady = false;
let engineLines = new Map();

const $ = id => document.getElementById(id);

function canonicalWhiteFen(kingSquare='e7') {
  const files = 'abcdefgh';
  const ranks = Array.from({length:8},()=>Array(8).fill(null));
  ranks[0] = [...WHITE_BACKRANK];
  const file = files.indexOf(kingSquare[0]);
  const rank = Number(kingSquare[1]);
  ranks[rank-1][file] = 'k';
  const rows = ranks.map(row => {
    let out='', empty=0;
    for (const x of row) {
      if (!x) empty++;
      else { if(empty){out+=empty;empty=0;} out+=x; }
    }
    if(empty) out+=empty;
    return out;
  });
  return rows.reverse().join('/') + ' w - - 0 1';
}

function boardOnlyFen(fen) { return fen.split(' ')[0]; }
function colorOf(piece) { return piece?.color === 'w' ? 'w' : 'b'; }
function typeName(t) { return {r:'Rooks',n:'Knights',b:'Bishops',q:'Queen',k:'King',p:'Pawns'}[t]; }

function renderBoard() {
  const el = $('board'); el.innerHTML = '';
  const files = orientation === 'w' ? 'abcdefgh' : 'hgfedcba';
  const ranks = orientation === 'w' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  for (const rank of ranks) for (const file of files) {
    const square = file + rank;
    const piece = game.get(square);
    const div = document.createElement('div');
    const light = ((file.charCodeAt(0)-97) + rank) % 2 === 1;
    div.className = `square ${light?'light':'dark'}`;
    if (square === selected) div.classList.add('selected');
    if (legalTargets.includes(square)) div.classList.add(piece ? 'capture' : 'legal');
    if ((orientation==='w' && rank===1) || (orientation==='b' && rank===8)) {
      const c=document.createElement('span'); c.className='coord'; c.textContent=file; div.appendChild(c);
    }
    if ((orientation==='w' && file==='a') || (orientation==='b' && file==='h')) {
      const c=document.createElement('span'); c.className='coord'; c.style.left='auto'; c.style.right='4px'; c.style.top='3px'; c.style.bottom='auto'; c.textContent=rank; div.appendChild(c);
    }
    if(piece){
      const span=document.createElement('span'); span.className='piece'; span.textContent=pieceGlyph[piece.color][piece.type]; div.appendChild(span);
    }
    div.onclick=()=>clickSquare(square);
    el.appendChild(div);
  }
  $('fen').value = game.fen();
  renderStatus(); renderResources();
}

function clickSquare(square) {
  const piece=game.get(square);
  if(selected && legalTargets.includes(square)) {
    try {
      const move = game.move({from:selected,to:square,promotion:'q'});
      selected=null; legalTargets=[]; renderBoard();
      if(move?.promotion==='q') renderStatus('Promotion defaulted to queen. Use the FEN box for other promotions.');
      return;
    } catch(e) {}
  }
  if(piece && piece.color === game.turn()) {
    selected=square;
    legalTargets=game.moves({square,verbose:true}).map(m=>m.to);
  } else { selected=null; legalTargets=[]; }
  renderBoard();
}

function renderStatus(extra='') {
  const status=[];
  if(game.isCheckmate()) status.push('<span class="good"><b>CHECKMATE.</b></span>');
  else if(game.isCheck()) status.push('<span class="warn"><b>CHECK.</b></span>');
  else if(game.isDraw()) status.push('<span class="bad"><b>DRAW.</b></span>');
  else status.push(`Side to move: <b>${game.turn()==='w'?'White':'Black'}</b>`);
  if(extra) status.push(extra);
  $('status').innerHTML=status.join(' · ');
}

function countPieces(chess, color) {
  const counts={p:0,n:0,b:0,r:0,q:0,k:0};
  for(const row of chess.board()) for(const p of row) if(p?.color===color) counts[p.type]++;
  return counts;
}

function resourceState(chess, color='w') {
  const c=countPieces(chess,color);
  const required={r:2,n:2,b:2,q:1,k:1};
  const missing={}; let totalMissing=0;
  for(const [t,n] of Object.entries(required)) { missing[t]=Math.max(0,n-c[t]); totalMissing+=missing[t]; }
  return {counts:c,missing,totalMissing,pawns:c.p,replaceable:totalMissing<=c.p};
}

function renderResources() {
  const r=resourceState(game,'w');
  const labels=['r','n','b','q','k'];
  $('resources').innerHTML=`<b>White reset resources</b><div class="resource-grid">${labels.map(t=>`<div class="resource"><span>${typeName(t)}</span><span>${r.counts[t]}/${{r:2,n:2,b:2,q:1,k:1}[t]}</span></div>`).join('')}</div><div class="small" style="margin-top:8px">Missing: ${r.totalMissing}. Promotion pawns available: ${r.pawns}. Necessary reconstruction test: <span class="${r.replaceable?'good':'bad'}">${r.replaceable?'possible':'insufficient pawns'}</span>.</div>`;
  $('resourceDetails').innerHTML=`<div class="resource-grid">${labels.map(t=>`<div class="resource"><span>${typeName(t)}</span><span>${r.counts[t]} present</span></div>`).join('')}</div>`;
}

function loadFen(fen) {
  try { game = new Chess(fen.trim()); selected=null; legalTargets=[]; renderBoard(); $('solverResult').innerHTML='<strong>Position loaded.</strong><span>Run the reset checker to test the canonical pattern.</span>'; }
  catch(e) { $('solverResult').innerHTML=`<strong class="bad">Invalid FEN</strong><span>${e.message}</span>`; }
}

function exactBackRank(chess,color='w') {
  const row=color==='w'?1:8;
  const expected=color==='w'?['r','n','b','q','k','b','n','r']:['r','n','b','q','k','b','n','r'];
  const actual='abcdefgh'.split('').map(f=>chess.get(f+row)?.type || '.');
  return actual.join('')==='rnbqkbnr';
}

function resetSequenceFor(color='w') { return color==='w'?WHITE_PATTERN:BLACK_PATTERN; }

// Search all legal opponent replies between the fixed premove sequence.
// This is the exact checker for the published pattern when the non-mover's
// side is a lone king. It does not guess a different reset pattern.
function findResetLine(start, color='w') {
  const sequence=resetSequenceFor(color);
  const memo=new Map();
  const dfs=(chess,index)=>{
    const key=`${index}|${chess.fen()}`;
    if(memo.has(key)) return memo.get(key);
    if(index===sequence.length) {
      const ok=color==='w' ? chess.isCheckmate() && chess.turn()==='b' : chess.isCheckmate() && chess.turn()==='w';
      const result=ok ? [] : null;
      memo.set(key,result); return result;
    }
    if(chess.turn()!==color) {
      const replies=chess.moves({verbose:true});
      for(const m of replies) {
        const c=new Chess(chess.fen());
        c.move(m);
        const tail=dfs(c,index);
        if(tail) {
          const result=[{side:'b',san:m.san,uci:m.uci},...tail];
          memo.set(key,result); return result;
        }
      }
      memo.set(key,null); return null;
    }
    const wanted=sequence[index].replace('#','');
    const legal=chess.moves({verbose:true});
    const move=legal.find(m=>m.san===wanted || (m.san||'').replace(/[+#]$/,'')===wanted);
    if(!move) { memo.set(key,null); return null; }
    const c=new Chess(chess.fen());
    c.move(move);
    const tail=dfs(c,index+1);
    if(tail) {
      const result=[{side:'w',san:move.san,uci:move.uci},...tail];
      memo.set(key,result); return result;
    }
    memo.set(key,null); return null;
  };
  return dfs(new Chess(start.fen()),0);
}

function checkFixedSequence(start, color='w') {
  return !!findResetLine(start,color);
}

function analyzeResetPosition() {
  const c=game;
  const whiteResources=resourceState(c,'w');
  const blackPieces=countPieces(c,'b');
  const loneBlack=blackPieces.k===1 && blackPieces.q===0 && blackPieces.r===0 && blackPieces.b===0 && blackPieces.n===0 && blackPieces.p===0;
  let text='';
  if(c.turn()!=='w') text='<span class="bad">White must be to move for the published white pattern.</span>';
  else if(!exactBackRank(c,'w')) text='<span class="warn">White is not currently on the restored back rank. The canonical pattern starts from the reset arrangement.</span>';
  else if(!loneBlack) text='<span class="warn">The exact checker is designed for a lone opposing king. Other black material can interfere with the pattern.</span>';
  else {
    const line=findResetLine(c,'w');
    text=line?`<span class="good"><b>RESET MATE FOUND.</b> A legal black-reply line exists for the published 20-move white pattern.</span>`:'<span class="bad">No legal black-reply line for the published sequence was found from this position.</span>';
  }
  $('solverResult').innerHTML=`<strong>Reset-mate checker</strong><span>${text}</span>`;
}

function randomResetPosition() {
  const candidates=['e7','e8','e6','d7','d8','c7','c8','b7','b8','f7','f8','g7','g8','c6','c5','e5','e4','f6','f5','g6'];
  for(let i=candidates.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [candidates[i],candidates[j]]=[candidates[j],candidates[i]]; }
  for(const king of candidates) {
    const candidate=new Chess(canonicalWhiteFen(king));
    if(findResetLine(candidate,'w')) {
      loadFen(candidate.fen());
      const line=findResetLine(candidate,'w');
      $('solverResult').innerHTML=`<strong>Verified reset position</strong><span>Black king: <code>${king}</code>. A legal black-reply line exists. Use <b>Find / play reset line</b> to load it into the trainer.</span>`;
      return;
    }
  }
  $('solverResult').innerHTML='<strong class="bad">Could not find a candidate quickly.</strong><span>Try the default e7 position or paste a FEN.</span>';
}

function updateMoveList() {
  const display = trainerLine.length ? trainerLine : WHITE_PATTERN.map(s=>({side:'w',san:s}));
  $('moveList').innerHTML=display.map((m,i)=>`<li class="${i===trainerIndex?'current':''}"><span>${i+1}.</span><span>${m.side==='w'?'White':'Black'}</span><code>${m.san}</code></li>`).join('');
}

function resetTrainer() {
  trainerBoard=new Chess(canonicalWhiteFen('e7'));
  trainerLine=findResetLine(trainerBoard,'w') || [];
  trainerIndex=0;
  game=new Chess(trainerBoard.fen());
  updateMoveList(); renderBoard();
}

function playNextPatternMove() {
  if(!trainerBoard) resetTrainer();
  if(trainerIndex>=trainerLine.length) return;
  const step=trainerLine[trainerIndex];
  try {
    const legal=trainerBoard.moves({verbose:true});
    const move=legal.find(x=>x.uci()===step.uci || x.san===step.san || (x.san||'').replace(/[+#]$/,'')===step.san.replace(/[+#]$/,''));
    if(!move) throw new Error(`Expected ${step.san} but it is not legal.`);
    trainerBoard.move(move);
    game=new Chess(trainerBoard.fen()); trainerIndex++; updateMoveList(); renderBoard();
  } catch(e) {
    $('solverResult').innerHTML=`<strong class="bad">Trainer stopped.</strong><span>${e.message}</span>`;
  }
}

async function loadStockfish() {
  if(engineReady) return;
  $('engineLog').textContent='Loading Stockfish 19 lite single-threaded…';
  try {
    const url='https://cdn.jsdelivr.net/npm/stockfish@19.0.0/src/stockfish-19-lite-single.js';
    engine=new Worker(url);
    engine.onmessage=(e)=>handleEngineLine(String(e.data));
    engine.postMessage('uci');
    engine.postMessage('setoption name MultiPV value 8');
    engineReady=true; $('botMoveBtn').disabled=false; $('engineBtn').textContent='Stockfish loaded';
    $('engineLog').textContent+='\nEngine worker started.';
  } catch(e) { $('engineLog').textContent='Could not load browser Stockfish. You can still use the exact reset solver and the Python bot.'; }
}

function handleEngineLine(line) {
  if(line.includes('bestmove')) {
    $('engineLog').textContent += `\n${line}`;
    return;
  }
  if(line.startsWith('info') && line.includes(' pv ')) {
    const m=line.match(/multipv (\d+).*?score (cp|mate) (-?\d+).*? pv (.*)$/);
    if(m) engineLines.set(Number(m[1]),{scoreType:m[2],score:Number(m[3]),pv:m[4].split(' ')});
  }
}

function materialHeuristic(chess) {
  const r=resourceState(chess,'w');
  const missing=r.totalMissing;
  let score=-missing*500;
  score += Math.min(r.pawns,missing)*250;
  // Reward being geometrically close to the restored rank.
  const target={a1:'r',b1:'n',c1:'b',d1:'q',e1:'k',f1:'b',g1:'n',h1:'r'};
  for(const [sq,t] of Object.entries(target)) {
    const p=chess.get(sq); if(p?.color==='w' && p.type===t) score+=150;
  }
  const bk=chess.get('c2'); if(bk?.color==='b'&&bk.type==='k') score+=100;
  return score;
}

async function askEngineMove() {
  if(!engineReady) await loadStockfish();
  if(!engineReady) return;
  engineLines.clear();
  const fen=game.fen();
  $('engineLog').textContent=`Analyzing position…\n${fen}`;
  engine.postMessage('ucinewgame');
  engine.postMessage(`position fen ${fen}`);
  engine.postMessage(`setoption name MultiPV value 8`);
  engine.postMessage(`go depth ${$('depth').value}`);
  setTimeout(()=>{
    const candidates=[...engineLines.values()];
    if(!candidates.length) { $('engineLog').textContent+='\nNo MultiPV result yet. Try again.'; return; }
    let best=null;
    for(const c of candidates) {
      if(!c.pv?.length) continue;
      try {
        const copy=new Chess(fen); const move=copy.move(c.pv[0]);
        const score=(c.scoreType==='mate' ? c.score*100000 : c.score)+materialHeuristic(copy);
        if(!best||score>best.score) best={...c,move,score};
      } catch {}
    }
    if(best) {
      game.move(best.move); selected=null; legalTargets=[]; renderBoard();
      $('engineLog').textContent+=`\nChosen: ${best.move.san}\nEngine score: ${best.scoreType} ${best.score}.\nCustom resource-aware score: ${best.score.toFixed(0)}`;
    }
  },1500);
}

function init() {
  $('fen').value=game.fen();
  renderBoard(); updateMoveList();
  $('flipBtn').onclick=()=>{orientation=orientation==='w'?'b':'w';renderBoard();};
  $('resetPositionBtn').onclick=()=>{game=new Chess();selected=null;legalTargets=[];renderBoard();};
  $('stepBackBtn').onclick=()=>{game.undo();selected=null;legalTargets=[];renderBoard();};
  $('loadFenBtn').onclick=()=>loadFen($('fen').value);
  $('autoPositionBtn').onclick=randomResetPosition;
  $('checkBtn').onclick=analyzeResetPosition;
  $('solveEndgameBtn').onclick=()=>{ if(!findResetLine(game,'w')) { loadFen(canonicalWhiteFen('e7')); } analyzeResetPosition(); document.querySelector('[data-tab="trainer"]').click(); resetTrainer(); };
  $('playPatternBtn').onclick=()=>{resetTrainer(); const id=setInterval(()=>{ if(trainerIndex>=WHITE_PATTERN.length){clearInterval(id);return;} playNextPatternMove();},500);};
  $('nextMoveBtn').onclick=playNextPatternMove;
  $('resetTrainerBtn').onclick=resetTrainer;
  $('engineBtn').onclick=loadStockfish;
  $('botMoveBtn').onclick=askEngineMove;
  $('depth').oninput=()=>{$('depthValue').textContent=$('depth').value;};
  document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(x=>x.classList.remove('active'));
    btn.classList.add('active'); $(btn.dataset.tab).classList.add('active');
  });
}
init();
