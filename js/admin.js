import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";


// ============================================================
// FIREBASE
// ============================================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();


// ============================================================
// HELPER
// ============================================================

const $ = (id) => document.getElementById(id);


// ============================================================
// ADMIN EMAILS
// ============================================================
//
// Thêm Gmail muốn cấp quyền quản trị vào đây.
//
// Ví dụ:
// "028riu@gmail.com",
// "gmail2@gmail.com",
// "abc@gmail.com"
//
// Không cần sửa các phần khác.
// ============================================================

const ADMIN_EMAILS = [
  "028riu@gmail.com",
  "tu0ngtun2gsahur8@gmail.com",
];


// Chuyển toàn bộ email về chữ thường để tránh lỗi
// do Gmail viết hoa / viết thường khác nhau.
const ADMIN_EMAILS_NORMALIZED = ADMIN_EMAILS.map(
  (email) => email.trim().toLowerCase()
);


// ============================================================
// DATA
// ============================================================

let subjects = [];
let homeworks = [];

let started = false;

let unsubscribeSubjects = null;
let unsubscribeHomework = null;


// ============================================================
// LOGIN ERROR
// ============================================================

function setLoginError(message = "") {
  const el = $("loginError");

  if (el) {
    el.textContent = message;
  }
}


// ============================================================
// HIDDEN / SHOW
// ============================================================

function setHidden(id, hidden) {
  const el = $(id);

  if (el) {
    el.classList.toggle("hidden", hidden);
  }
}


// ============================================================
// CHECK ADMIN
// ============================================================

function isAdmin(user) {
  if (!user || !user.email) {
    return false;
  }

  const email = user.email.trim().toLowerCase();

  return ADMIN_EMAILS_NORMALIZED.includes(email);
}


// ============================================================
// GOOGLE LOGIN
// ============================================================

$("googleLoginBtn").addEventListener("click", async () => {
  setLoginError("");

  const button = $("googleLoginBtn");

  if (button) {
    button.disabled = true;
  }

  try {
    await signInWithPopup(auth, provider);

  } catch (error) {
    console.error("Google Login Error:", error);

    setLoginError(
      "Không thể đăng nhập: " +
      (error.code || error.message || "Lỗi không xác định")
    );

  } finally {
    if (button) {
      button.disabled = false;
    }
  }
});


// ============================================================
// LOGOUT
// ============================================================

$("logoutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);

  } catch (error) {
    console.error("Logout Error:", error);
  }
});


// ============================================================
// AUTH STATE
// ============================================================

onAuthStateChanged(auth, (user) => {

  // ----------------------------------------------------------
  // Chưa đăng nhập
  // ----------------------------------------------------------

  if (!user) {

    setHidden("loginView", false);
    setHidden("dashboard", true);

    started = false;

    stopListeners();

    return;
  }


  // ----------------------------------------------------------
  // Đã đăng nhập nhưng KHÔNG phải admin
  // ----------------------------------------------------------

  if (!isAdmin(user)) {

    setHidden("loginView", false);
    setHidden("dashboard", true);

    setLoginError(
      `Tài khoản ${user.email || "này"} không có quyền quản trị.`
    );

    signOut(auth).catch((error) => {
      console.error("Admin sign-out error:", error);
    });

    return;
  }


  // ----------------------------------------------------------
  // ADMIN HỢP LỆ
  // ----------------------------------------------------------

  setLoginError("");

  setHidden("loginView", true);
  setHidden("dashboard", false);

  const adminUser = $("adminUser");

  if (adminUser) {
    adminUser.textContent =
      `${user.displayName || "Admin"} · ${user.email || ""}`;
  }

  start();
});


// ============================================================
// STOP FIRESTORE LISTENERS
// ============================================================

function stopListeners() {

  if (unsubscribeSubjects) {
    unsubscribeSubjects();
  }

  if (unsubscribeHomework) {
    unsubscribeHomework();
  }

  unsubscribeSubjects = null;
  unsubscribeHomework = null;
}


// ============================================================
// START FIRESTORE
// ============================================================

function start() {

  if (started) {
    return;
  }

  started = true;


  // ----------------------------------------------------------
  // SUBJECTS
  // ----------------------------------------------------------

  const subjectsQuery = query(
    collection(db, "subjects"),
    orderBy("order", "asc")
  );

  unsubscribeSubjects = onSnapshot(
    subjectsQuery,

    (snapshot) => {

      subjects = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

      renderSubjects();
      fillSubjectSelect();
      renderHomework();
      updateStats();
    },

    (error) => {

      console.error(
        "Subjects Firestore error:",
        error
      );

      const container = $("adminTabs");

      if (container) {
        container.innerHTML =
          `<p class="error">
            Không thể tải môn học: ${esc(error.message)}
          </p>`;
      }
    }
  );


  // ----------------------------------------------------------
  // HOMEWORK
  // ----------------------------------------------------------

  const homeworkQuery = query(
    collection(db, "homework"),
    orderBy("createdAt", "desc")
  );

  unsubscribeHomework = onSnapshot(
    homeworkQuery,

    (snapshot) => {

      homeworks = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

      renderHomework();
      updateStats();
    },

    (error) => {

      console.error(
        "Homework Firestore error:",
        error
      );

      const container = $("adminHomework");

      if (container) {
        container.innerHTML =
          `<p class="error">
            Không thể tải bài tập: ${esc(error.message)}
          </p>`;
      }
    }
  );
}


// ============================================================
// RENDER SUBJECTS
// ============================================================

function renderSubjects() {

  const container = $("adminTabs");

  if (!container) {
    return;
  }


  if (!subjects.length) {

    container.innerHTML =
      `<p class="muted">Chưa có môn học.</p>`;

    return;
  }


  container.innerHTML = subjects.map((subject) => `

    <div class="admin-item">

      <b>
        ${esc(subject.icon || "📚")}
        ${esc(subject.name || "Môn học")}
      </b>

      <div class="actions">

        <button
          type="button"
          data-action="edit-subject"
          data-id="${esc(subject.id)}"
        >
          Sửa
        </button>

        <button
          type="button"
          class="danger"
          data-action="delete-subject"
          data-id="${esc(subject.id)}"
        >
          Xóa
        </button>

      </div>

    </div>

  `).join("");
}


// ============================================================
// RENDER HOMEWORK
// ============================================================

function renderHomework() {

  const container = $("adminHomework");

  if (!container) {
    return;
  }


  if (!homeworks.length) {

    container.innerHTML =
      `<p class="muted">Chưa có bài tập.</p>`;

    return;
  }


  container.innerHTML = homeworks.map((homework) => {

    const subject = subjects.find(
      (item) => item.id === homework.subjectId
    );


    let dueText = "Không đặt hạn";


    if (homework.dueDate) {

      const due = new Date(homework.dueDate);

      if (!Number.isNaN(due.getTime())) {

        dueText = due.toLocaleString("vi-VN");
      }
    }


    return `

      <div class="admin-item">

        <b>
          ${homework.pinned ? "📌 " : ""}
          ${homework.important ? "⭐ " : ""}
          ${esc(homework.title || "Bài tập")}
        </b>

        <small>
          ${esc(subject?.icon || "📚")}
          ${esc(subject?.name || "Chưa phân loại")}
          ·
          ${esc(dueText)}
        </small>

        <div class="actions">

          <button
            type="button"
            data-action="edit-homework"
            data-id="${esc(homework.id)}"
          >
            Sửa
          </button>

          <button
            type="button"
            class="danger"
            data-action="delete-homework"
            data-id="${esc(homework.id)}"
          >
            Xóa
          </button>

        </div>

      </div>

    `;

  }).join("");
}


// ============================================================
// SUBJECT SELECT
// ============================================================

function fillSubjectSelect(selectedId = "") {

  const select = $("hwTab");

  if (!select) {
    return;
  }


  if (!subjects.length) {

    select.innerHTML =
      `<option value="">Chưa có môn học</option>`;

    return;
  }


  select.innerHTML = subjects.map((subject) => `

    <option value="${esc(subject.id)}">
      ${esc(subject.icon || "📚")}
      ${esc(subject.name || "Môn học")}
    </option>

  `).join("");


  if (
    selectedId &&
    subjects.some(
      (subject) => subject.id === selectedId
    )
  ) {

    select.value = selectedId;
  }
}


// ============================================================
// STATISTICS
// ============================================================

function updateStats() {

  const statHomework = $("statHomework");
  const statTabs = $("statTabs");
  const statPinned = $("statPinned");


  if (statHomework) {
    statHomework.textContent =
      String(homeworks.length);
  }


  if (statTabs) {
    statTabs.textContent =
      String(subjects.length);
  }


  if (statPinned) {
    statPinned.textContent =
      String(
        homeworks.filter(
          (item) => item.pinned
        ).length
      );
  }
}


// ============================================================
// NEW HOMEWORK
// ============================================================

$("newHomework").addEventListener("click", () => {

  if (!subjects.length) {

    alert(
      "Hãy tạo ít nhất 1 môn học trước."
    );

    return;
  }


  $("homeworkForm").reset();

  $("hwDialogTitle").textContent =
    "Tạo bài tập";

  $("hwId").value = "";

  $("hwError").textContent = "";

  fillSubjectSelect();

  $("homeworkDialog").showModal();
});


// ============================================================
// SAVE HOMEWORK
// ============================================================

$("homeworkForm").addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const id =
      $("hwId").value.trim();

    const subjectId =
      $("hwTab").value;

    const title =
      $("hwTitle").value.trim();

    const content =
      $("hwContent").value.trim();


    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if (!subjectId) {

      $("hwError").textContent =
        "Vui lòng chọn môn học.";

      return;
    }


    if (!title) {

      $("hwError").textContent =
        "Vui lòng nhập tiêu đề.";

      return;
    }


    if (!content) {

      $("hwError").textContent =
        "Vui lòng nhập nội dung.";

      return;
    }


    // --------------------------------------------------------
    // DATA
    // --------------------------------------------------------

    const data = {

      subjectId,

      title,

      content,

      dueDate:
        $("hwDue").value || null,

      pinned:
        $("hwPinned").checked,

      important:
        $("hwImportant").checked,

      updatedAt:
        serverTimestamp()
    };


    // --------------------------------------------------------
    // CREATED AT
    // --------------------------------------------------------

    if (id) {

      const oldHomework =
        homeworks.find(
          (item) => item.id === id
        );

      data.createdAt =
        oldHomework?.createdAt ||
        serverTimestamp();

    } else {

      data.createdAt =
        serverTimestamp();
    }


    // --------------------------------------------------------
    // SAVE
    // --------------------------------------------------------

    try {

      const documentId =
        id || crypto.randomUUID();


      await setDoc(
        doc(
          db,
          "homework",
          documentId
        ),
        data
      );


      $("hwError").textContent = "";

      $("homeworkDialog").close();


    } catch (error) {

      console.error(
        "Save homework error:",
        error
      );

      $("hwError").textContent =
        "Không thể lưu: " +
        error.message;
    }

  }
);


// ============================================================
// NEW SUBJECT
// ============================================================

$("newTab").addEventListener(
  "click",
  () => {

    $("tabForm").reset();

    $("tabDialogTitle").textContent =
      "Tạo môn học";

    $("tabId").value = "";

    $("tabError").textContent = "";

    $("tabDialog").showModal();
  }
);


// ============================================================
// SAVE SUBJECT
// ============================================================

$("tabForm").addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const id =
      $("tabId").value.trim();

    const name =
      $("tabName").value.trim();

    const icon =
      $("tabIcon").value.trim() ||
      "📚";


    // --------------------------------------------------------
    // VALIDATION
    // --------------------------------------------------------

    if (!name) {

      $("tabError").textContent =
        "Vui lòng nhập tên môn học.";

      return;
    }


    // --------------------------------------------------------
    // ORDER
    // --------------------------------------------------------

    const oldSubject =
      subjects.find(
        (item) => item.id === id
      );


    const order = id

      ? (oldSubject?.order || 0)

      : (
          subjects.length
            ? Math.max(
                ...subjects.map(
                  (item) =>
                    item.order || 0
                )
              ) + 1
            : 1
        );


    // --------------------------------------------------------
    // DATA
    // --------------------------------------------------------

    const data = {

      name,

      icon,

      order,

      updatedAt:
        serverTimestamp()
    };


    // --------------------------------------------------------
    // SAVE
    // --------------------------------------------------------

    try {

      const documentId =
        id || crypto.randomUUID();


      await setDoc(
        doc(
          db,
          "subjects",
          documentId
        ),
        data
      );


      $("tabError").textContent = "";

      $("tabDialog").close();


    } catch (error) {

      console.error(
        "Save subject error:",
        error
      );

      $("tabError").textContent =
        "Không thể lưu: " +
        error.message;
    }

  }
);


// ============================================================
// HOMEWORK BUTTON EVENTS
// ============================================================

$("adminHomework").addEventListener(
  "click",
  (event) => {

    const button =
      event.target.closest(
        "button[data-action]"
      );

    if (!button) {
      return;
    }


    const id =
      button.dataset.id;


    if (
      button.dataset.action ===
      "edit-homework"
    ) {

      editHomework(id);
    }


    if (
      button.dataset.action ===
      "delete-homework"
    ) {

      removeHomework(id);
    }

  }
);


// ============================================================
// SUBJECT BUTTON EVENTS
// ============================================================

$("adminTabs").addEventListener(
  "click",
  (event) => {

    const button =
      event.target.closest(
        "button[data-action]"
      );

    if (!button) {
      return;
    }


    const id =
      button.dataset.id;


    if (
      button.dataset.action ===
      "edit-subject"
    ) {

      editSubject(id);
    }


    if (
      button.dataset.action ===
      "delete-subject"
    ) {

      removeSubject(id);
    }

  }
);


// ============================================================
// EDIT HOMEWORK
// ============================================================

function editHomework(id) {

  const homework =
    homeworks.find(
      (item) => item.id === id
    );


  if (!homework) {
    return;
  }


  $("hwDialogTitle").textContent =
    "Sửa bài tập";

  $("hwId").value =
    homework.id;


  fillSubjectSelect(
    homework.subjectId || ""
  );


  $("hwTitle").value =
    homework.title || "";


  $("hwContent").value =
    homework.content || "";


  $("hwDue").value =
    homework.dueDate || "";


  $("hwPinned").checked =
    !!homework.pinned;


  $("hwImportant").checked =
    !!homework.important;


  $("hwError").textContent = "";


  $("homeworkDialog").showModal();
}


// ============================================================
// DELETE HOMEWORK
// ============================================================

async function removeHomework(id) {

  if (
    !confirm(
      "Bạn có chắc muốn xóa bài tập này?"
    )
  ) {

    return;
  }


  try {

    await deleteDoc(
      doc(
        db,
        "homework",
        id
      )
    );


  } catch (error) {

    console.error(
      "Delete homework error:",
      error
    );

    alert(
      "Không thể xóa: " +
      error.message
    );
  }
}


// ============================================================
// EDIT SUBJECT
// ============================================================

function editSubject(id) {

  const subject =
    subjects.find(
      (item) => item.id === id
    );


  if (!subject) {
    return;
  }


  $("tabId").value =
    id;


  $("tabName").value =
    subject.name || "";


  $("tabIcon").value =
    subject.icon || "";


  $("tabDialogTitle").textContent =
    "Sửa môn học";


  $("tabError").textContent = "";


  $("tabDialog").showModal();
}


// ============================================================
// DELETE SUBJECT
// ============================================================

async function removeSubject(id) {

  const hasHomework =
    homeworks.some(
      (item) =>
        item.subjectId === id
    );


  if (hasHomework) {

    alert(
      "Môn này đang có bài tập.\n\n" +
      "Hãy chuyển hoặc xóa các bài tập " +
      "thuộc môn này trước."
    );

    return;
  }


  if (
    !confirm(
      "Bạn có chắc muốn xóa môn này?"
    )
  ) {

    return;
  }


  try {

    await deleteDoc(
      doc(
        db,
        "subjects",
        id
      )
    );


  } catch (error) {

    console.error(
      "Delete subject error:",
      error
    );

    alert(
      "Không thể xóa: " +
      error.message
    );
  }
}


// ============================================================
// ESCAPE HTML
// ============================================================

function esc(value = "") {

  return String(value).replace(
    /[&<>"']/g,

    (character) => ({

      "&": "&amp;",

      "<": "&lt;",

      ">": "&gt;",

      '"': "&quot;",

      "'": "&#39;"

    })[character]
  );
}
