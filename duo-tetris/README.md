# Duo Tetris

Node.js + Express + Socket.IO 기반 1:1 실시간 테트리스 대전입니다. 플레이어 두 명이 매칭되면 함께 시작하고, 먼저 블록이 꼭대기에 닿으면 패배합니다. 낙하 속도는 경과 시간에 따라 30초마다 양쪽에서 동일하게 빨라집니다.

## 실행

```bash
npm install
npm start
```

브라우저에서 `http://localhost:3000`을 열고, 시크릿 창이나 다른 기기에서 한 명 더 접속해 매칭을 확인하세요.

## 조작

- `A` / `D`: 좌우 이동
- `S`: 빠른 낙하
- 방향키 좌우/아래도 지원

## GitHub와 Render 배포

1. 이 폴더를 새 GitHub 저장소에 올립니다.
2. Render에서 **New → Web Service**를 선택하고 GitHub 저장소를 연결합니다.
3. `render.yaml` 설정을 적용해 배포합니다. Render가 `npm install` 후 `npm start`를 실행합니다.

매칭 대기열과 대전 상태는 Node 프로세스 메모리에 저장됩니다. 초기 단일 Render 인스턴스에 맞춘 구현이며, 여러 인스턴스로 확장할 때는 Redis 어댑터와 공유 매칭 저장소를 붙여야 합니다. 무료 인스턴스는 사용하지 않을 때 잠들 수 있어 첫 접속 시 기동 시간이 생길 수 있습니다.
