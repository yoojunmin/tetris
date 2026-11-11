(() => {
  const socket = io();
  const COLS = 10, ROWS = 20, CELL = 30;
  const COLORS = [null, '#60d7e8', '#5576ed', '#f5a04e', '#f5d85b', '#a877ea', '#71d889', '#ed6f76'];
  const SHAPES = [null, [[1,1,1,1]], [[2,0,0],[2,2,2]], [[0,0,3],[3,3,3]], [[4,4],[4,4]], [[0,5,0],[5,5,5]], [[0,6,6],[6,6,0]], [[7,7,0],[0,7,7]]];
  const boardCanvas = document.querySelector('#game-board'), ctx = boardCanvas.getContext('2d');
  const opponentCanvas = document.querySelector('#opponent-board'), octx = opponentCanvas.getContext('2d');
  const nextCanvas = document.querySelector('#next-board'), nctx = nextCanvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  let board = [], current = null, next = null, room = null, startAt = 0, playing = false, searching = false, ended = false;
  let score = 0, lines = 0, level = 1, lastDrop = 0, lastSent = 0, animFrame = null, opponentBoard = null;

  function blankBoard() { return Array.from({ length: ROWS }, () => Array(COLS).fill(0)); }
  function randomPiece() { const id = 1 + Math.floor(Math.random() * 7); return { id, shape: SHAPES[id].map(row => row.slice()), x: Math.floor((COLS - SHAPES[id][0].length) / 2), y: 0 }; }
  function drawGrid(context, data, cell, canvasWidth, canvasHeight, ghost = false) {
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    context.fillStyle = '#13151a'; context.fillRect(0, 0, canvasWidth, canvasHeight);
    for (let y = 0; y < data.length; y++) for (let x = 0; x < data[y].length; x++) {
      const value = data[y][x];
      if (value) {
        context.globalAlpha = ghost ? .22 : 1; context.fillStyle = COLORS[value];
        context.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
        context.fillStyle = '#ffffff28'; context.fillRect(x * cell + 3, y * cell + 3, cell - 6, Math.max(2, cell * .1));
        context.globalAlpha = 1;
      } else { context.strokeStyle = '#ffffff0b'; context.strokeRect(x * cell + .5, y * cell + .5, cell, cell); }
    }
  }
  function render() {
    const view = visibleBoard();
    drawGrid(ctx, view, CELL, boardCanvas.width, boardCanvas.height);
    drawGrid(octx, opponentBoard || blankBoard(), 20, opponentCanvas.width, opponentCanvas.height);
    nctx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (next) {
      const shape = SHAPES[next.id], size = 22, w = shape[0].length * size, h = shape.length * size;
      const ox = (nextCanvas.width - w) / 2, oy = (nextCanvas.height - h) / 2;
      shape.forEach((row,y) => row.forEach((v,x) => { if (!v) return; nctx.fillStyle = COLORS[next.id]; nctx.fillRect(ox+x*size+1,oy+y*size+1,size-2,size-2); }));
    }
  }
  function visibleBoard() {
    const view = board.map(row => row.slice());
    if (current && playing) {
      const ghost = { ...current, y: current.y };
      while (!collides(ghost, 0, 1)) ghost.y++;
      place(view, ghost); place(view, current);
    }
    return view;
  }
  function collides(piece, dx = 0, dy = 0) {
    for (let y = 0; y < piece.shape.length; y++) for (let x = 0; x < piece.shape[y].length; x++) if (piece.shape[y][x]) {
      const bx = piece.x + x + dx, by = piece.y + y + dy;
      if (bx < 0 || bx >= COLS || by >= ROWS || (by >= 0 && board[by][bx])) return true;
    }
    return false;
  }
  function place(target, piece, ghost = false) {
    piece.shape.forEach((row,y) => row.forEach((value,x) => { const by = piece.y + y; if (value && by >= 0) target[by][piece.x+x] = ghost ? value : value; }));
  }
  function spawn() {
    current = next || randomPiece(); next = randomPiece();
    if (collides(current)) finish(false);
    render();
  }
  function lock() {
    place(board, current); let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) if (board[y].every(Boolean)) { board.splice(y, 1); board.unshift(Array(COLS).fill(0)); cleared++; y++; }
    if (cleared) { lines += cleared; score += [0,100,300,500,800][cleared] * level; level = 1 + Math.floor(lines / 10); updateStats(); }
    spawn();
  }
  function updateStats() { $('score').textContent = String(score).padStart(6,'0'); $('lines').textContent = String(lines).padStart(2,'0'); $('level').textContent = String(level).padStart(2,'0'); }
  function move(dx) { if (!playing || !current) return; if (!collides(current, dx, 0)) { current.x += dx; render(); } }
  function softDrop() { if (!playing || !current) return; if (!collides(current,0,1)) { current.y++; score++; $('score').textContent = String(score).padStart(6,'0'); } else lock(); render(); }
  function gameLoop(now) {
    if (!playing) return;
    const elapsed = Math.max(0, Date.now() - startAt);
    const sharedLevel = 1 + Math.floor(elapsed / 30000);
    const dropInterval = Math.max(120, 850 - (sharedLevel - 1) * 80);
    if (now - lastDrop >= dropInterval) { if (!collides(current,0,1)) current.y++; else lock(); lastDrop = now; render(); }
    if (Date.now() - lastSent > 150) { socket.emit('board-update',{room,board:visibleBoard(),score,lines,level:sharedLevel}); lastSent=Date.now(); }
    $('level').textContent = String(sharedLevel).padStart(2,'0');
    animFrame = requestAnimationFrame(gameLoop);
  }
  function finish(won) {
    if (ended || !room) return;
    playing = false; ended = true;
    if (!won) socket.emit('game-over', room);
    $('match-status').textContent = won ? 'VICTORY' : 'DEFEAT';
    $('board-overlay').classList.remove('hidden');
    $('board-overlay').innerHTML = `<div class="overlay-symbol">${won ? '✦' : '×'}</div><strong>${won ? '승리!' : '게임 오버'}</strong><span>${won ? '상대가 먼저 탈락했습니다.' : '상대가 승리했습니다.'}</span>`;
    $('play-label').textContent='다시 매칭'; $('play-button').disabled=false;
    $('queue-note').textContent='버튼을 눌러 다음 대전을 시작하세요';
  }
  function toast(text) { const el=$('toast'); el.textContent=text; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2600); }

  socket.on('connect',()=>{ $('connection-dot').style.background='var(--lime)'; $('connection-label').textContent='서버 연결됨'; });
  socket.on('disconnect',()=>{ $('connection-dot').style.background='var(--orange)'; $('connection-label').textContent='연결 끊김'; if (playing) { playing=false; $('match-status').textContent='연결 끊김'; toast('서버 연결이 끊어졌습니다.'); } });
  socket.on('queue-status',({position})=>{ searching=true; $('play-label').textContent='매칭 취소'; $('play-button').disabled=false; $('match-status').textContent='상대 찾는 중'; $('queue-note').textContent=position===1?'상대 플레이어를 기다리는 중...':`${position}번째로 대기 중`; });
  socket.on('queue-cancelled',()=>{ searching=false; $('play-label').textContent='빠른 매칭'; $('queue-note').textContent='매칭이 취소되었습니다'; $('match-status').textContent='대기 중'; });
  socket.on('match-found',(data)=>{
    searching=false; room=data.room; startAt=data.startAt; ended=false; board=blankBoard(); opponentBoard=blankBoard(); score=0;lines=0;level=1;next=null;current=null;updateStats();
    const opponent=data.players.find(p=>p.id!==socket.id); $('opponent-name').textContent=opponent?.name||'Opponent'; $('room-id').textContent=room.slice(-6).toUpperCase(); $('match-count').innerHTML='1 <small>vs</small> 1'; $('opponent-placeholder').style.display='none';
    $('play-button').disabled=true; $('play-label').textContent='매칭 완료'; $('queue-note').textContent='상대와 연결되었습니다'; $('match-status').textContent='준비 중';
    $('board-overlay').classList.remove('hidden'); $('board-overlay').innerHTML='<div class="overlay-symbol">3</div><strong>대전 준비</strong><span>양쪽 플레이어가 동시에 시작합니다.</span>';
    const countdown=()=>{ const left=startAt-Date.now(); if(left<=0){ $('board-overlay').classList.add('hidden'); playing=true;lastDrop=performance.now();spawn();gameLoop(performance.now());$('match-status').textContent='IN GAME';$('play-button').disabled=true; }else{ $('board-overlay').querySelector('.overlay-symbol').textContent=String(Math.ceil(left/1000)); setTimeout(countdown,100); } };countdown();
  });
  socket.on('opponent-board',(data)=>{ opponentBoard=data.board||opponentBoard; $('opponent-lines').textContent=String(data.lines||0).padStart(2,'0'); $('opponent-level').textContent=String(data.level||1).padStart(2,'0');render(); });
  socket.on('match-over',({winnerId})=>finish(winnerId===socket.id));
  socket.on('opponent-left',()=>{ if(!ended){playing=false;ended=true;$('match-status').textContent='상대 나감';$('board-overlay').classList.remove('hidden');$('board-overlay').innerHTML='<div class="overlay-symbol">✓</div><strong>상대가 나갔습니다</strong><span>새 대전을 시작할 수 있어요.</span>';$('play-button').disabled=false;$('play-label').textContent='다시 매칭';$('queue-note').textContent='버튼을 눌러 새 상대를 찾으세요';} });

  $('play-button').addEventListener('click',()=>{
    if(searching){socket.emit('cancel-match');return;}
    if(room){socket.emit('leave-match',room);room=null;}
    const name=$('player-name').value.trim()||'Player';socket.emit('find-match',name);$('play-button').disabled=true;$('play-label').textContent='상대 찾는 중';$('queue-note').textContent='매칭 서버에 접속 중...';$('match-status').textContent='매칭 중';$('board-overlay').classList.remove('hidden');$('board-overlay').innerHTML='<div class="overlay-symbol">⌁</div><strong>상대를 찾고 있어요</strong><span>잠시만 기다려주세요.</span>'; $('opponent-placeholder').style.display='flex';$('opponent-name').textContent='상대 찾는 중';
  });
  document.addEventListener('keydown',(event)=>{if(['a','d','s','ArrowLeft','ArrowRight','ArrowDown'].includes(event.key)){event.preventDefault();if(event.key==='a'||event.key==='ArrowLeft')move(-1);if(event.key==='d'||event.key==='ArrowRight')move(1);if(event.key==='s'||event.key==='ArrowDown')softDrop();}});
  drawGrid(ctx,blankBoard(),CELL,boardCanvas.width,boardCanvas.height);drawGrid(octx,blankBoard(),20,opponentCanvas.width,opponentCanvas.height);
})();
