// Smart Campus Planner - 3단계: 새로고침해도 유지되도록 저장하기 (localStorage 사용)
// 1~2단계 기능(추가 / 완료 체크 / 삭제 / 완료율 표시)은 그대로 유지하고,
// 여기에 "브라우저 저장소에 저장하고 불러오는" 기능만 추가합니다.

// 브라우저(localStorage)에 할 일 데이터를 저장할 때 사용할 키 이름
const STORAGE_KEY = "smartCampusPlanner.todos";

// 화면에 표시할 카테고리/중요도 값 -> 라벨, 스타일 매핑
const CATEGORY_LABELS = {
  class: "수업",
  project: "프로젝트",
  thesis: "논문",
  personal: "개인",
};

const PRIORITY_LABELS = {
  high: "상",
  mid: "중",
  low: "하",
};

// 정렬 시 중요도 순서를 비교하기 위한 우선순위 값 (숫자가 작을수록 먼저 표시)
// 요구사항: 상 -> 중 -> 하 순서
const PRIORITY_ORDER = {
  high: 0,
  mid: 1,
  low: 2,
};

// 할 일 데이터를 담아두는 배열
// 페이지를 처음 열 때 브라우저에 저장되어 있던 데이터가 있으면 불러와서 시작합니다.
let todos = loadTodos();

// 각 할 일에 부여할 고유 id (목록 렌더링/식별용)
// 불러온 할 일들 중 가장 큰 id보다 1 큰 값부터 시작하도록 계산해서, id가 겹치지 않게 함
let nextId = calculateNextId(todos);

// localStorage에서 저장된 할 일 목록을 읽어옴
// 저장된 데이터가 없거나, 형식이 잘못되어 있거나, 브라우저 저장소를 사용할 수 없는 경우에는
// 오류 없이 빈 목록([])으로 시작하도록 처리합니다.
function loadTodos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed;
  } catch (error) {
    console.warn("저장된 할 일 데이터를 불러오지 못했습니다. 빈 목록으로 시작합니다.", error);
    return [];
  }
}

// 현재 todos 배열을 localStorage에 저장 (추가/완료 체크/삭제할 때마다 호출됨)
function saveTodos() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch (error) {
    console.warn("할 일 데이터를 저장하지 못했습니다.", error);
  }
}

// 불러온 할 일 목록을 기준으로, 다음에 사용할 id 값을 계산
function calculateNextId(list) {
  if (!list || list.length === 0) return 1;

  const maxId = list.reduce(function (max, todo) {
    return typeof todo.id === "number" && todo.id > max ? todo.id : max;
  }, 0);

  return maxId + 1;
}

// DOM 요소 참조
const form = document.getElementById("todo-form");
const titleInput = document.getElementById("title");
const categorySelect = document.getElementById("category");
const prioritySelect = document.getElementById("priority");
const dueDateInput = document.getElementById("dueDate");
const formError = document.getElementById("form-error");

// 마감일 입력 시 오늘 이전 날짜는 선택할 수 없도록 제한
(function restrictDueDateToToday() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  dueDateInput.min = yyyy + "-" + mm + "-" + dd;
})();

const todoList = document.getElementById("todo-list");
const emptyMessage = document.getElementById("empty-message");
const todoCount = document.getElementById("todo-count");

const progressPercent = document.getElementById("progress-percent");
const progressBarFill = document.getElementById("progress-bar-fill");
const progressDetail = document.getElementById("progress-detail");

// 폼 제출(할 일 추가) 처리
form.addEventListener("submit", function (event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const category = categorySelect.value;
  const priority = prioritySelect.value;
  const dueDate = dueDateInput.value;

  // 간단한 입력 검증: 하나라도 비어 있으면 추가하지 않고 안내 문구를 보여줌
  if (!title || !category || !priority || !dueDate) {
    showFormError("제목, 카테고리, 중요도, 마감일을 모두 입력해주세요.");
    return;
  }

  // 마감일이 오늘보다 이전이면 추가하지 않고 안내 문구를 보여줌
  if (dueDate < dueDateInput.min) {
    showFormError("마감일은 오늘 이후 날짜로만 선택할 수 있어요.");
    return;
  }


  hideFormError();

  const newTodo = {
    id: nextId++,
    title,
    category,
    priority,
    dueDate,
    completed: false,
  };

  todos.push(newTodo);
  saveTodos();
  renderTodoList();

  form.reset();
  titleInput.focus();
});

function showFormError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function hideFormError() {
  formError.hidden = true;
  formError.textContent = "";
}

// 목록에 표시할 순서대로 할 일들을 정렬해서 새 배열로 반환
// 정렬 기준(우선순위 순): 1) 마감일이 빠른 순 -> 2) 중요도(상 > 중 > 하) -> 3) 입력한 순서
// 원본 todos 배열의 순서(= 저장 데이터, 입력 순서)는 바꾸지 않고, 화면 표시용 정렬된 사본만 만듭니다.
function getSortedTodos() {
  // slice()로 복사본을 만든 뒤 정렬하여, 원본 todos 배열의 순서(입력 순서)는 그대로 유지되게 함
  return todos.slice().sort(function (a, b) {
    // 1) 마감일이 빠른 순 (문자열 "YYYY-MM-DD" 형식은 그대로 비교해도 날짜 순서와 일치함)
    if (a.dueDate !== b.dueDate) {
      return a.dueDate < b.dueDate ? -1 : 1;
    }

    // 2) 중요도: 상 -> 중 -> 하 순
    const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    // 3) 마감일과 중요도가 모두 같으면 입력한 순서 그대로 (Array.sort는 안정 정렬이므로
    //    0을 반환하면 원래(=입력) 순서가 자동으로 유지됩니다)
    return 0;
  });
}

// 현재 todos 배열을 기준으로 목록 화면을 다시 그림
function renderTodoList() {
  todoList.innerHTML = "";

  const sortedTodos = getSortedTodos();

  if (sortedTodos.length === 0) {
    emptyMessage.hidden = false;
    todoList.hidden = true;
  } else {
    emptyMessage.hidden = true;
    todoList.hidden = false;

    sortedTodos.forEach(function (todo) {
      todoList.appendChild(createTodoItemElement(todo));
    });
  }

  todoCount.textContent = todos.length + "개";
  updateProgress();
}

// 전체 할 일 대비 완료된 할 일의 비율(완료율)을 계산해서 화면에 반영
function updateProgress() {
  const total = todos.length;
  const completedCount = todos.filter(function (todo) {
    return todo.completed;
  }).length;

  // 할 일이 하나도 없을 때는 0으로 나누는 것을 피하기 위해 0%로 처리
  const percent = total === 0 ? 0 : Math.round((completedCount / total) * 100);

  progressPercent.textContent = percent + "%";
  progressBarFill.style.width = percent + "%";
  progressDetail.textContent = "완료 " + completedCount + "개 / 전체 " + total + "개";
}

// 완료 체크박스를 눌렀을 때: 완료 <-> 미완료 상태를 토글
function toggleTodoCompleted(id) {
  const todo = todos.find(function (t) {
    return t.id === id;
  });

  if (!todo) return;

  todo.completed = !todo.completed;
  saveTodos();
  renderTodoList();
}

// 삭제 버튼을 눌렀을 때: 목록에서 해당 할 일을 제거
function deleteTodo(id) {
  todos = todos.filter(function (t) {
    return t.id !== id;
  });
  saveTodos();
  renderTodoList();
}

// 할 일 하나를 나타내는 <li> 요소를 생성
function createTodoItemElement(todo) {
  const li = document.createElement("li");
  li.className = "todo-item" + (todo.completed ? " todo-item-completed" : "");
  li.dataset.id = String(todo.id);

  // 완료 체크박스
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "todo-checkbox";
  checkbox.checked = todo.completed;
  checkbox.setAttribute("aria-label", "완료 체크");
  checkbox.addEventListener("change", function () {
    toggleTodoCompleted(todo.id);
  });

  const main = document.createElement("div");
  main.className = "todo-main";

  const titleEl = document.createElement("span");
  titleEl.className = "todo-title";
  titleEl.textContent = todo.title;

  const tags = document.createElement("div");
  tags.className = "todo-tags";

  const categoryTag = document.createElement("span");
  categoryTag.className = "tag tag-category-" + todo.category;
  categoryTag.textContent = CATEGORY_LABELS[todo.category] || todo.category;

  const priorityTag = document.createElement("span");
  priorityTag.className = "tag tag-priority-" + todo.priority;
  priorityTag.textContent = "중요도: " + (PRIORITY_LABELS[todo.priority] || todo.priority);

  const dueEl = document.createElement("span");
  dueEl.className = "todo-due";
  dueEl.textContent = "마감일: " + formatDate(todo.dueDate);

  tags.appendChild(categoryTag);
  tags.appendChild(priorityTag);

  main.appendChild(titleEl);
  main.appendChild(tags);
  main.appendChild(dueEl);

  // 삭제 버튼
  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn-delete";
  deleteBtn.textContent = "삭제";
  deleteBtn.addEventListener("click", function () {
    deleteTodo(todo.id);
  });

  li.appendChild(checkbox);
  li.appendChild(main);
  li.appendChild(deleteBtn);

  return li;
}

// "YYYY-MM-DD" 형태의 날짜 문자열을 "YYYY.MM.DD" 형태로 보기 좋게 변환
function formatDate(dateString) {
  if (!dateString) return "";
  const parts = dateString.split("-");
  if (parts.length !== 3) return dateString;
  return parts[0] + "." + parts[1] + "." + parts[2];
}

// 헤더의 "Today" 영역에 오늘 날짜를 표시 (디자인 요소, 별도 기능 로직에는 영향 없음)
function renderTodayDate() {
  const todayEl = document.getElementById("today-date");
  if (!todayEl) return;

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  todayEl.textContent = yyyy + "." + mm + "." + dd;
}

// 초기 화면 렌더링
// todos는 이미 위에서 loadTodos()를 통해 저장된 데이터(있다면)로 채워진 상태이므로,
// 페이지를 새로고침해도 이전에 등록했던 할 일들이 그대로 화면에 나타납니다.
renderTodayDate();
renderTodoList();
