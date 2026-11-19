let handPose;
let hands = [];
let video;
let statusMessage = "Loading model...";
let bgImg;
let colorPicker;
let styleSelect;
let sizeSlider;
let sizes = { circle: 22, square: 20, dotted: 8 };


const fingertips = [
  { name: "indexFinger",  index: 8,  joint: 6 },
];

let trails = {};
for (let f of fingertips) {
  trails[f.name] = [];
}

let smoothTips = {};


// function preload() {
//   img = loadImage("assets/hand.jpg");
// }

function preload() {
  bgImg = loadImage("assets/paper.jpg");
}

function drawCover(img) {
  let s = max(width / img.width, height / img.height);
  let w = img.width * s;
  let h = img.height * s;
  image(img, (width - w) / 2, (height - h) / 2, w, h);
}

async function setup() {
  createCanvas(windowWidth, windowHeight);
  video = createCapture(VIDEO);
  video.size(width, height);
  video.hide();

  colorPicker = createColorPicker("#2d09fa");
  colorPicker.position(12, 40);

  // todo: add finger distance z with map() to change dynamically shape sizes

  styleSelect = createSelect();
  styleSelect.option("circle");
  styleSelect.option("square");
  styleSelect.option("dotted");
  styleSelect.selected("circle");
  styleSelect.position(70, 40);

  sizeSlider = createSlider(4, 60, sizes[styleSelect.value()]); // 최소, 최대, 시작값
  sizeSlider.position(180, 40);
  sizeSlider.style("width", "120px");

  

  sizeSlider.input(() => {
    sizes[styleSelect.value()] = sizeSlider.value();
  });


  styleSelect.changed(() => {
    sizeSlider.value(sizes[styleSelect.value()]);
  });


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
  drawCover(bgImg);

  push();
  translate(width, 0);
  scale(-1, 1);
  // image(video, 0, 0, width, height);

  if (hands.length > 0) {
    let keypoints = hands[0].keypoints;

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
        let previous = t[t.length - 1];
        let now = millis();
        let speed = 0;
        if (previous && previous !== null && now > previous.time) {
          let elapsed = (now - previous.time) / 1000;
          let instantSpeed = dist(previous.x, previous.y, tip.x, tip.y) / elapsed;
          speed = lerp(previous.speed || 0, instantSpeed, 0.35);
        }
        t.push({
          x: tip.x,
          y: tip.y,
          speed,
          time: now,
          c: colorPicker.value(),
          s: styleSelect.value(),
          w: sizes[styleSelect.value()],
        });
      } else if (t.length > 0 && t[t.length - 1] !== null) {
         t.push(null);
      }
    }
  } else {
    
    for (let f of fingertips) {
      let t = trails[f.name];
      if (t.length > 0 && t[t.length - 1] !== null) t.push(null);
    }
  }

for (let f of fingertips) {
  let trail = trails[f.name];

  drawTrail(p5.instance, trail);

  // 지금 그리고 있는 손가락 끝에만 원 표시
  let last = trail[trail.length - 1];
  if (last) {
    fill(last.c);
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
  // console.log(results);
  hands = results;
}

// 같은 좌표에서는 항상 같은 값을 돌려주는 의사 난수 (크레파스 질감이 깜빡이지 않게)
function rnd(a, b) {
  let v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

// p: 그릴 대상 (화면이면 p5.instance, 저장용이면 createGraphics로 만든 g)
function drawTrail(p, trail) {
  let run = [];

  const flush = () => {
    if (run.length > 1) drawRun(p, run);
    run = [];
  };

  for (let k = 0; k < trail.length; k++) {
    let pt = trail[k];
    if (pt === null) {
      flush();
      continue;
    }
    // 스타일, 색, 크기가 바뀌면 새 구간을 시작합니다 (끊김 없이 이어지게 이전 점을 복사)
    if (run.length > 0) {
      let first = run[0];
      if (first.s !== pt.s || first.c !== pt.c || first.w !== pt.w) {
        let prev = run[run.length - 1];
        flush();
        run = [{ x: prev.x, y: prev.y, speed: prev.speed, s: pt.s, c: pt.c, w: pt.w }];
      }
    }
    run.push(pt);
  }
  flush();
}

// 선을 따라 일정한 간격으로 도장을 찍듯이 도형을 그리는 도우미 함수
function stampAlong(run, spacing, drawShape) {
  let next = 0; // 다음 도형까지 남은 거리
  for (let k = 1; k < run.length; k++) {
    let a = run[k - 1];
    let b = run[k];
    let len = dist(a.x, a.y, b.x, b.y);
    let speed = constrain(((a.speed + b.speed) / 2) / 900, 0, 1);
    let segmentSpacing = spacing * (1 + speed);
    while (next <= len) {
      let t = len === 0 ? 0 : next / len;
      drawShape(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
      next += segmentSpacing;
    }
    next -= len;
  }
}

function drawRun(p, run) {
  let last = run[run.length - 1];
  let style = last.s;
  let col = last.c;
  let size = last.w;

  if (style === "circle") {
    p.noStroke();
    p.fill(col);
    stampAlong(run, size * 0.7, (x, y) => p.circle(x, y, size));
  } else if (style === "square") {
    p.noStroke();
    p.fill(col);
    p.rectMode(CENTER);
    stampAlong(run, size * 0.8, (x, y) => p.rect(x, y, size, size));
  } else {
    p.noFill();
    p.stroke(col);
    p.strokeWeight(size);
    p.strokeCap(SQUARE);
    p.drawingContext.setLineDash([size * 2, size * 1.7]);
    p.beginShape();
    for (let pt of run) p.vertex(pt.x, pt.y);
    p.endShape();
    p.drawingContext.setLineDash([]);
  }
}

function keyPressed() {
  if (key === "c" || key === "C") {
    for (let f of fingertips) {
      trails[f.name] = [];
    }
  }

  if (key === "s" || key === "S") {
    saveDrawing(false);
  }
}