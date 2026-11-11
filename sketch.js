let handPose;
let hands = [];
let video;
let statusMessage = "Loading model...";

const fingertips = [
  { name: "thumb",        index: 4,  joint: 3,  color: [0, 0, 0] },
  { name: "indexFinger",  index: 8,  joint: 6,  color: [0, 200, 0] },
  { name: "middleFinger", index: 12, joint: 10, color: [0, 100, 255] },
  { name: "ringFinger",   index: 16, joint: 14, color: [255, 200, 0] },
  { name: "pinky",        index: 20, joint: 18, color: [160, 0, 220] },
];

let trails = {};
for (let f of fingertips) {
  trails[f.name] = [];
}

let smoothTips = {};

const MAX_TRAIL = 100;
// function isFingerExtended(keypoints, f) {
//   let wrist = keypoints[0];
//   let tip = keypoints[f.index];
//   if (f.name === "thumb") {
//     // 엄지: 끝(4)이 검지 뿌리(5)·새끼 뿌리(17)에서 얼마나 떨어져 있는지로 판단
//     let indexBase = keypoints[5];
//     let pinkyBase = keypoints[17];
//     let palmWidth = dist(indexBase.x, indexBase.y, pinkyBase.x, pinkyBase.y);
//     let tipToIndexBase = dist(tip.x, tip.y, indexBase.x, indexBase.y);
//     let tipToPinkyBase = dist(tip.x, tip.y, pinkyBase.x, pinkyBase.y);
//     return tipToIndexBase > palmWidth * 0.7 && tipToPinkyBase > palmWidth * 1.1;
//   }

//   // 나머지 손가락: 뿌리(MCP) - 중간관절(PIP) - 끝(TIP) 사이 각도로 판단
//   let mcp = keypoints[f.mcp];
//   let pip = keypoints[f.joint];
//   let a = createVector(mcp.x - pip.x, mcp.y - pip.y);
//   let b = createVector(tip.x - pip.x, tip.y - pip.y);
//   let angle = degrees(a.angleBetween(b));

//   // 쭉 펴면 180도에 가깝고, 접을수록 작아짐
//   let tipDist = dist(wrist.x, wrist.y, tip.x, tip.y);
//   let pipDist = dist(wrist.x, wrist.y, pip.x, pip.y);
//   return angle > 150 && tipDist > pipDist * 1.2;
// }


// function preload() {
//   img = loadImage("assets/hand.jpg");
// }

async function setup() {
  createCanvas(windowWidth, windowHeight);
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  handPose = ml5.handPose();
  await handPose.ready;
  statusMessage = "Ready";
  handPose.detectStart(video, gotHands);
}

function isFingerExtended(keypoints, f) {
  let wrist = keypoints[0];
  let tip = keypoints[f.index];
  let joint = keypoints[f.joint];
  return dist(wrist.x, wrist.y, tip.x, tip.y) >
         dist(wrist.x, wrist.y, joint.x, joint.y) * 1.15;
}

function draw() {
  background(255);

  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);

  if (hands.length > 0) {
    let keypoints = hands[0].keypoints;

    // 펼쳐진 손가락 목록을 구하고, 정확히 1개일 때만 그 손가락을 활성화
    let extended = fingertips.filter((f) => isFingerExtended(keypoints, f));
    let activeName = extended.length === 1 ? extended[0].name : null;

    for (let f of fingertips) {
      let target = keypoints[f.index];

      if (!smoothTips[f.name]) {
        smoothTips[f.name] = { x: target.x, y: target.y };
      }
      let tip = smoothTips[f.name];
      tip.x = lerp(tip.x, target.x, 0.3);
      tip.y = lerp(tip.y, target.y, 0.3);

      let t = trails[f.name];
      if (f.name === activeName) {
        t.push({ x: tip.x, y: tip.y });
        if (t.length > MAX_TRAIL) t.shift();
      } else if (t.length > 0 && t[t.length - 1] !== null) {
        t.push(null); // 선이 이어지지 않도록 끊기
      }
    }
  } else {
    // 손이 사라지면 모든 선을 끊어 둠
    for (let f of fingertips) {
      let t = trails[f.name];
      if (t.length > 0 && t[t.length - 1] !== null) t.push(null);
    }
  }

  for (let f of fingertips) {
    let trail = trails[f.name];

    stroke(f.color[0], f.color[1], f.color[2]);
    strokeWeight(6);
    noFill();

    for (let k = 1; k < trail.length; k++) {
      if (trail[k] === null || trail[k - 1] === null) continue;
      line(trail[k - 1].x, trail[k - 1].y, trail[k].x, trail[k].y);
    }

    // 지금 그리고 있는 손가락 끝에만 원 표시
    let last = trail[trail.length - 1];
    if (last) {
      fill(f.color[0], f.color[1], f.color[2]);
      stroke(255);
      strokeWeight(3);
      circle(last.x, last.y, 24);
    }
  }
  pop();

  fill(0);
  noStroke();
  text(statusMessage, 12, 24);
}

function gotHands(results) {
  hands = results;
}

function keyPressed() {
  if (key === "c") {
    for (let f of fingertips) {
      trails[f.name] = [];
      smoothTips[f.name] = null;
    }
  }
}