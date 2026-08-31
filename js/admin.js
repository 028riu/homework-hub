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

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-storage.js";

import { firebaseConfig } from "./firebase-config.js";


/* =========================================================
   FIREBASE
   ========================================================= */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const provider = new GoogleAuthProvider();

const $ = (id) => document.getElementById(id);


/* =========================================================
   ADMIN EMAIL
   ========================================================= */

const ADMIN_EMAILS = [
  "028riu@gmail.com",
  "tu0ngtun2gsahur8@gmail.com",
  "linh085760@gmail.com",
  "phuong026443@stu.vinschool.edu.vn"
].map((email) => email.toLowerCase());


/* =========================================================
   STATE
   ========================================================= */

let subjects = [];
let homeworks = [];
let users = [];

let started = false;

let unsubscribeSubjects = null;
let unsubscribeHomework = null;
let unsubscribeUsers = null;
let unsubscribeSettings = null;

let userSearchText = "";

let siteSettings = {
  noHomeworkNoticeEnabled: true,
  oldHomeworkNoticeEnabled: true,

  noHomeworkNoticeTitle: "📚 Hôm nay không có bài tập mới",
  noHomeworkNoticeMessage: "Hôm nay chưa có bài tập mới được cập nhật.",

  oldHomeworkNoticeTitle: "📢 Bài tập chưa có cập nhật",
  oldHomeworkNoticeMessage: "Danh sách bài tập hôm nay vẫn giống ngày trước."
};


/* =========================================================
   UTILS
   ========================================================= */

function isAdminEmail(email) {
  if (!email) return false;

  return ADMIN_EMAILS.includes(
    String(email).toLowerCase()
  );
}


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


function safeFileName(name) {
  return String(name || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}


function normalizeNumber(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}


function todayKey() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}


function dateKeyFromValue(value) {
  if (!value) return "";

  try {
    let date;

    if (typeof value?.toDate === "function") {
      date = value.toDate();
    } else if (typeof value?.seconds === "number") {
      date = new Date(value.seconds * 1000);
    } else {
      date = new Date(value);
    }

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");

  } catch {
    return "";
  }
}


function formatDate(value) {
  if (!value) return "Chưa có";

  try {
    let date;

    if (typeof value?.toDate === "function") {
      date = value.toDate();
    } else if (typeof value?.seconds === "number") {
      date = new Date(value.seconds * 1000);
    } else {
      date = new Date(value);
    }

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString("vi-VN");

  } catch {
    return String(value);
  }
}


function getUserStreak(user) {
  return Math.max(
    0,
    normalizeNumber(
      user.streak ?? user.currentStreak,
      0
    )
  );
}


function getUserLongest(user) {
  return Math.max(
    getUserStreak(user),
    normalizeNumber(
      user.longestStreak ??
      user.highestStreak ??
      user.maxStreak,
      0
    )
  );
}


function getUserLastAccess(user) {
  return (
    user.lastVisitAt ||
    user.lastAccess ||
    user.lastLoginAt ||
    user.lastLoginDate ||
    user.lastVisitDate ||
    null
  );
}


function getUserName(user) {
  return (
    user.displayName ||
    user.username ||
    user.name ||
    user.email ||
    "Người dùng"
  );
}


function getDueText(value) {
  if (!value) return "Không đặt hạn";

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleString("vi-VN");

  } catch {
    return String(value);
  }
}


function showDialog(id) {
  const dialog = $(id);

  if (!dialog) return;

  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.classList.remove("hidden");
  }
}


function closeDialog(id) {
  const dialog = $(id);

  if (dialog?.open) {
    dialog.close();
  }
}


function setLoginError(message = "") {
  const element = $("loginError");

  if (element) {
    element.textContent = message;
  }
}


function setHidden(id, hidden) {
  $(id)?.classList.toggle("hidden", hidden);
}


/* =========================================================
   LOGIN
   ========================================================= */

$("googleLoginBtn")?.addEventListener(
  "click",
  async () => {

    setLoginError("");

    const button = $("googleLoginBtn");

    if (!button) return;

    button.disabled = true;

    try {

      await signInWithPopup(
        auth,
        provider
      );

    } catch (error) {

      console.error(
        "Google Login Error:",
        error
      );

      setLoginError(
        `Không thể đăng nhập: ${
          error?.code ||
          error?.message ||
          "Lỗi không xác định"
        }`
      );

    } finally {

      button.disabled = false;
    }
  }
);


$("logoutBtn")?.addEventListener(
  "click",
  async () => {

    try {

      await signOut(auth);

    } catch (error) {

      console.error(
        "Logout Error:",
        error
      );
    }
  }
);


onAuthStateChanged(
  auth,
  (user) => {

    if (!user) {

      setHidden(
        "loginView",
        false
      );

      setHidden(
        "dashboard",
        true
      );

      started = false;

      stopListeners();

      return;
    }


    if (!isAdminEmail(user.email)) {

      setHidden(
        "loginView",
        false
      );

      setHidden(
        "dashboard",
        true
      );

      setLoginError(
        `Tài khoản ${
          user.email || "này"
        } không có quyền quản trị.`
      );

      signOut(auth).catch(
        (error) => {
          console.error(
            "Admin sign-out:",
            error
          );
        }
      );

      return;
    }


    setLoginError("");

    setHidden(
      "loginView",
      true
    );

    setHidden(
      "dashboard",
      false
    );


    const adminUser = $("adminUser");

    if (adminUser) {
      adminUser.textContent =
        `${user.displayName || "Admin"} · ${
          user.email || ""
        }`;
    }


    ensureManagementPanel();

    start();
  }
);


/* =========================================================
   LISTENERS
   ========================================================= */

function stopListeners() {

  const listeners = [
    unsubscribeSubjects,
    unsubscribeHomework,
    unsubscribeUsers,
    unsubscribeSettings
  ];

  listeners.forEach(
    (unsubscribe) => {

      if (typeof unsubscribe === "function") {
        unsubscribe();
      }

    }
  );


  unsubscribeSubjects = null;
  unsubscribeHomework = null;
  unsubscribeUsers = null;
  unsubscribeSettings = null;
}


function start() {

  if (started) return;

  started = true;


  /* SUBJECTS */

  unsubscribeSubjects = onSnapshot(
    query(
      collection(db, "subjects"),
      orderBy("order", "asc")
    ),

    (snapshot) => {

      subjects = snapshot.docs.map(
        (item) => ({
          id: item.id,
          ...item.data()
        })
      );

      renderSubjects();
      fillSubjectSelect();
      renderHomework();
      updateAllStats();
    },

    (error) => {

      console.error(
        "Subjects Firestore error:",
        error
      );

      showPanelError(
        "adminTabs",
        "Không thể tải môn học",
        error
      );
    }
  );


  /* HOMEWORK */

  unsubscribeHomework = onSnapshot(
    query(
      collection(db, "homework"),
      orderBy("createdAt", "desc")
    ),

    (snapshot) => {

      homeworks = snapshot.docs.map(
        (item) => ({
          id: item.id,
          ...item.data()
        })
      );

      renderHomework();
      updateAllStats();
    },

    (error) => {

      console.error(
        "Homework Firestore error:",
        error
      );

      showPanelError(
        "adminHomework",
        "Không thể tải bài tập",
        error
      );
    }
  );


  /* USERS */

  unsubscribeUsers = onSnapshot(
    collection(db, "users"),

    (snapshot) => {

      users = snapshot.docs.map(
        (item) => ({
          id: item.id,
          ...item.data()
        })
      );

      renderUsers();
      updateAllStats();
    },

    (error) => {

      console.error(
        "Users Firestore error:",
        error
      );

      showPanelError(
        "adminUsers",
        "Không thể tải người dùng",
        error
      );
    }
  );


  /* SETTINGS */

  unsubscribeSettings = onSnapshot(
    doc(
      db,
      "settings",
      "site"
    ),

    (snapshot) => {

      if (snapshot.exists()) {

        siteSettings = {
          ...siteSettings,
          ...snapshot.data()
        };
      }

      renderSiteSettings();
    },

    (error) => {

      console.error(
        "Settings Firestore error:",
        error
      );

      showPanelError(
        "adminSettings",
        "Không thể tải cài đặt",
        error
      );
    }
  );
}


function showPanelError(
  id,
  prefix,
  error
) {

  const element = $(id);

  if (!element) return;

  element.innerHTML =
    `<p class="error">${
      esc(prefix)
    }: ${
      esc(
        error?.message ||
        "Lỗi không xác định"
      )
    }</p>`;
}


/* =========================================================
   SUBJECTS
   ========================================================= */

function renderSubjects() {

  const container = $("adminTabs");

  if (!container) return;


  if (!subjects.length) {

    container.innerHTML =
      `<p class="muted">
        Chưa có môn học.
      </p>`;

    return;
  }


  container.innerHTML =
    subjects
      .map(
        (subject) => `
          <div class="admin-item">

            <b>
              ${esc(subject.icon || "📚")}
              ${esc(subject.name || "Môn học")}
            </b>

            <small>
              ID: ${esc(subject.id)}
            </small>

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
        `
      )
      .join("");
}


function fillSubjectSelect(
  selectedId = ""
) {

  const select = $("hwTab");

  if (!select) return;


  select.innerHTML = subjects.length

    ? subjects
        .map(
          (subject) => `
            <option value="${esc(subject.id)}">
              ${esc(subject.icon || "📚")}
              ${esc(subject.name || "Môn học")}
            </option>
          `
        )
        .join("")

    : `
      <option value="">
        Chưa có môn học
      </option>
    `;


  if (selectedId) {
    select.value = selectedId;
  }
}


/* NEW SUBJECT */

$("newTab")?.addEventListener(
  "click",
  () => {

    $("tabForm")?.reset();

    if ($("tabId")) {
      $("tabId").value = "";
    }

    if ($("tabDialogTitle")) {
      $("tabDialogTitle").textContent =
        "Tạo môn học";
    }

    if ($("tabError")) {
      $("tabError").textContent = "";
    }

    showDialog("tabDialog");
  }
);


$("tabForm")?.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const id =
      $("tabId")?.value.trim() || "";

    const name =
      $("tabName")?.value.trim() || "";

    const icon =
      $("tabIcon")?.value.trim() || "📚";

    const errorEl = $("tabError");


    if (!name) {

      if (errorEl) {
        errorEl.textContent =
          "Vui lòng nhập tên môn học.";
      }

      return;
    }


    const old =
      subjects.find(
        (item) => item.id === id
      );


    const order = id

      ? normalizeNumber(
          old?.order,
          0
        )

      : (
          subjects.length

            ? Math.max(
                ...subjects.map(
                  (item) =>
                    normalizeNumber(
                      item.order,
                      0
                    )
                )
              ) + 1

            : 1
        );


    try {

      await setDoc(
        doc(
          db,
          "subjects",
          id || crypto.randomUUID()
        ),
        {
          name,
          icon,
          order,
          updatedAt:
            serverTimestamp()
        }
      );


      closeDialog(
        "tabDialog"
      );


      if (errorEl) {
        errorEl.textContent = "";
      }

    } catch (error) {

      console.error(
        "Save subject error:",
        error
      );

      if (errorEl) {
        errorEl.textContent =
          `Không thể lưu: ${
            error.message
          }`;
      }
    }
  }
);


/* =========================================================
   ATTACHMENTS
   ========================================================= */

function normalizeAttachments(
  homework
) {

  const list =
    Array.isArray(
      homework?.attachments
    )
      ? homework.attachments
      : [];


  const result = list
    .map(
      (item) => {

        const type =
          item.type === "file"
            ? "file"
            : "link";


        return {

          type,

          url:
            item.url ||
            item.fileUrl ||
            item.linkUrl ||
            "",

          name:
            item.name ||
            item.fileName ||
            (
              type === "file"
                ? "Tệp đính kèm"
                : "Liên kết"
            ),

          fileName:
            item.fileName ||
            item.name ||
            "",

          fileType:
            item.fileType ||
            "",

          size:
            normalizeNumber(
              item.size ||
              item.fileSize,
              0
            ),

          storagePath:
            item.storagePath ||
            ""
        };
      }
    )
    .filter(
      (item) => item.url
    );


  /* SUPPORT OLD DATA */

  if (
    !result.length &&
    homework?.linkUrl
  ) {

    result.push({
      type: "link",
      url: homework.linkUrl,
      name: "Liên kết"
    });
  }


  if (
    !result.length &&
    homework?.fileUrl
  ) {

    result.push({

      type: "file",

      url: homework.fileUrl,

      name:
        homework.fileName ||
        "Tệp đính kèm",

      fileName:
        homework.fileName ||
        "Tệp đính kèm",

      fileType:
        homework.fileType ||
        ""
    });
  }


  return result;
}


function attachmentRowsFromHomework(
  homework
) {

  const attachments =
    normalizeAttachments(
      homework
    );


  if (!attachments.length) {
    return;
  }


  attachments.forEach(
    (attachment) => {

      addAttachmentRow(
        attachment.type,
        attachment
      );

    }
  );
}


/* =========================================================
   ADD ATTACHMENT ROW
   ========================================================= */

function addAttachmentRow(
  type = "link",
  data = null
) {

  const list =
    $("attachmentList");

  if (!list) return;


  const row =
    document.createElement("div");

  row.className =
    "attachment-row";

  row.dataset.type =
    type;


  /* LINK */

  if (type === "link") {

    row.innerHTML = `
      <div class="attachment-icon">
        🔗
      </div>

      <div class="attachment-main">

        <b>
          Liên kết
        </b>

        <input
          class="attachment-url"
          type="url"
          placeholder="https://..."
          value="${esc(data?.url || "")}"
          autocomplete="off"
        >

        <small>
          Không bắt buộc.
          Có thể thêm nhiều link bằng nút +.
        </small>

      </div>

      <button
        type="button"
        class="icon-btn remove-attachment"
        title="Xóa"
      >
        ×
      </button>
    `;

  }


  /* FILE */

  else {

    row.innerHTML = `
      <div class="attachment-icon">
        📎
      </div>

      <div class="attachment-main">

        <b>
          File từ máy
        </b>

        <input
          class="attachment-file"
          type="file"
        >

        <input
          class="attachment-existing-url"
          type="hidden"
          value="${esc(data?.url || "")}"
        >

        <input
          class="attachment-existing-name"
          type="hidden"
          value="${esc(
            data?.name ||
            data?.fileName ||
            ""
          )}"
        >

        <input
          class="attachment-existing-path"
          type="hidden"
          value="${esc(
            data?.storagePath ||
            ""
          )}"
        >

        <small>
          ${
            data?.name
              ? `File hiện tại: ${esc(data.name)}`
              : "Không bắt buộc. Có thể thêm nhiều file bằng nút +."
          }
        </small>

      </div>

      <button
        type="button"
        class="icon-btn remove-attachment"
        title="Xóa"
      >
        ×
      </button>
    `;
  }


  list.appendChild(row);
}


function clearAttachmentRows() {

  const list =
    $("attachmentList");

  if (list) {
    list.innerHTML = "";
  }
}


/* =========================================================
   COLLECT ATTACHMENTS
   ========================================================= */

function collectAttachmentRows() {

  const rows = [
    ...document.querySelectorAll(
      "#attachmentList .attachment-row"
    )
  ];


  return rows
    .map(
      (row) => {

        const type =
          row.dataset.type;


        if (type === "link") {

          return {

            type: "link",

            url:
              row
                .querySelector(
                  ".attachment-url"
                )
                ?.value
                .trim() || ""
          };
        }


        return {

          type: "file",

          file:
            row
              .querySelector(
                ".attachment-file"
              )
              ?.files?.[0] || null,

          existingUrl:
            row
              .querySelector(
                ".attachment-existing-url"
              )
              ?.value || "",

          existingName:
            row
              .querySelector(
                ".attachment-existing-name"
              )
              ?.value || "",

          existingPath:
            row
              .querySelector(
                ".attachment-existing-path"
              )
              ?.value || ""
        };
      }
    )
    .filter(
      (item) => {

        if (item.type === "link") {
          return !!item.url;
        }

        return (
          !!item.file ||
          !!item.existingUrl
        );
      }
    );
}


/* =========================================================
   UPLOAD FILE
   ========================================================= */

async function uploadAttachment(
  file,
  homeworkId
) {

  if (!file) {
    throw new Error(
      "Không có file để upload."
    );
  }


  const safeName =
    safeFileName(
      file.name
    );


  const path =
    `homework/${homeworkId}/${Date.now()}_${crypto.randomUUID()}_${safeName}`;


  const storageRef =
    ref(
      storage,
      path
    );


  await uploadBytes(
    storageRef,
    file,
    {
      contentType:
        file.type ||
        "application/octet-stream",

      customMetadata: {
        originalName:
          file.name
      }
    }
  );


  const url =
    await getDownloadURL(
      storageRef
    );


  return {

    type: "file",

    url,

    name:
      file.name,

    fileName:
      file.name,

    fileType:
      file.type ||
      "application/octet-stream",

    size:
      file.size,

    storagePath:
      path
  };
}


/* =========================================================
   DELETE STORAGE FILES
   ========================================================= */

async function deleteStorageFiles(
  attachments
) {

  const files =
    normalizeAttachments({
      attachments
    })
    .filter(
      (item) =>
        item.storagePath
    );


  await Promise.all(
    files.map(
      async (item) => {

        try {

          await deleteObject(
            ref(
              storage,
              item.storagePath
            )
          );

        } catch (error) {

          console.warn(
            "Could not delete old storage file:",
            error
          );
        }
      }
    )
  );
}


function renderAttachmentSummary(
  homework
) {

  const attachments =
    normalizeAttachments(
      homework
    );


  if (!attachments.length) {
    return "";
  }


  return `
    <small>
      📎 ${attachments.length}
      tệp/link đính kèm
    </small>
  `;
}


/* =========================================================
   HOMEWORK
   ========================================================= */

function renderHomework() {

  const container =
    $("adminHomework");

  if (!container) return;


  if (!homeworks.length) {

    container.innerHTML =
      `<p class="muted">
        Chưa có bài tập.
      </p>`;

    return;
  }


  container.innerHTML =
    homeworks
      .map(
        (homework) => {

          const subject =
            subjects.find(
              (item) =>
                item.id ===
                homework.subjectId
            );


          return `
            <div class="admin-item">

              <b>
                ${
                  homework.pinned
                    ? "📌 "
                    : ""
                }

                ${
                  homework.important
                    ? "⭐ "
                    : ""
                }

                ${esc(
                  homework.title ||
                  "Bài tập"
                )}
              </b>

              <small>
                ${esc(
                  subject?.icon ||
                  "📚"
                )}

                ${esc(
                  subject?.name ||
                  "Chưa phân loại"
                )}

                ·

                ${esc(
                  getDueText(
                    homework.dueDate
                  )
                )}
              </small>

              <small>
                ${esc(
                  homework.content ||
                  ""
                )}
              </small>

              ${renderAttachmentSummary(
                homework
              )}

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
        }
      )
      .join("");
}


/* =========================================================
   NEW HOMEWORK
   ========================================================= */

$("newHomework")?.addEventListener(
  "click",
  () => {

    if (!subjects.length) {

      alert(
        "Hãy tạo ít nhất 1 môn học trước."
      );

      return;
    }


    $("homeworkForm")?.reset();


    if ($("hwId")) {
      $("hwId").value = "";
    }


    if ($("hwDialogTitle")) {
      $("hwDialogTitle").textContent =
        "Tạo bài tập";
    }


    if ($("hwError")) {
      $("hwError").textContent = "";
    }


    if ($("hwUploadProgress")) {
      $("hwUploadProgress").textContent =
        "";
    }


    clearAttachmentRows();

    fillSubjectSelect();

    showDialog(
      "homeworkDialog"
    );
  }
);


/* =========================================================
   ADD LINK / ADD FILE
   ========================================================= */

$("addLinkBtn")?.addEventListener(
  "click",
  () => {

    addAttachmentRow(
      "link"
    );
  }
);


$("addFileBtn")?.addEventListener(
  "click",
  () => {

    addAttachmentRow(
      "file"
    );
  }
);


/* =========================================================
   REMOVE ATTACHMENT
   ========================================================= */

$("attachmentList")?.addEventListener(
  "click",
  (event) => {

    const button =
      event.target.closest(
        ".remove-attachment"
      );


    if (!button) return;


    const row =
      button.closest(
        ".attachment-row"
      );


    row?.remove();
  }
);


/* =========================================================
   SAVE HOMEWORK
   ========================================================= */

$("homeworkForm")?.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const errorEl =
      $("hwError");

    const progressEl =
      $("hwUploadProgress");

    const saveButton =
      $("saveHomeworkBtn");


    const id =
      $("hwId")?.value.trim() || "";

    const subjectId =
      $("hwTab")?.value || "";

    const title =
      $("hwTitle")?.value.trim() || "";

    const content =
      $("hwContent")?.value.trim() || "";


    if (errorEl) {
      errorEl.textContent = "";
    }


    if (progressEl) {
      progressEl.textContent = "";
    }


    if (!subjectId) {

      if (errorEl) {
        errorEl.textContent =
          "Vui lòng chọn môn học.";
      }

      return;
    }


    if (!title) {

      if (errorEl) {
        errorEl.textContent =
          "Vui lòng nhập tiêu đề.";
      }

      return;
    }


    if (!content) {

      if (errorEl) {
        errorEl.textContent =
          "Vui lòng nhập nội dung.";
      }

      return;
    }


    const oldHomework =
      homeworks.find(
        (item) =>
          item.id === id
      );


    const homeworkId =
      id ||
      crypto.randomUUID();


    const rows =
      collectAttachmentRows();


    const maxBytes =
      50 * 1024 * 1024;


    /* CHECK FILE SIZE */

    for (const row of rows) {

      if (
        row.type === "file" &&
        row.file &&
        row.file.size > maxBytes
      ) {

        if (errorEl) {

          errorEl.textContent =
            `File "${row.file.name}" vượt quá 50 MB.`;
        }

        return;
      }
    }


    if (saveButton) {
      saveButton.disabled = true;
    }


    try {

      const attachments = [];


      /* PROCESS EACH ATTACHMENT */

      for (
        let index = 0;
        index < rows.length;
        index += 1
      ) {

        const row =
          rows[index];


        if (progressEl) {

          progressEl.textContent =
            `Đang xử lý tệp ${index + 1}/${rows.length}...`;
        }


        /* LINK */

        if (
          row.type === "link"
        ) {

          attachments.push({

            type: "link",

            url: row.url,

            name: row.url
          });

          continue;
        }


        /* NEW FILE */

        if (row.file) {

          const uploaded =
            await uploadAttachment(
              row.file,
              homeworkId
            );


          attachments.push(
            uploaded
          );

          continue;
        }


        /* EXISTING FILE */

        if (row.existingUrl) {

          attachments.push({

            type: "file",

            url:
              row.existingUrl,

            name:
              row.existingName ||
              "Tệp đính kèm",

            fileName:
              row.existingName ||
              "Tệp đính kèm",

            storagePath:
              row.existingPath ||
              ""
          });
        }
      }


      /* SAVE FIRESTORE */

      const data = {

        subjectId,

        title,

        content,

        dueDate:
          $("hwDue")?.value ||
          null,

        pinned:
          !!$("hwPinned")?.checked,

        important:
          !!$("hwImportant")?.checked,

        attachments,

        updatedAt:
          serverTimestamp(),

        createdAt:
          oldHomework?.createdAt ||
          serverTimestamp()
      };


      await setDoc(
        doc(
          db,
          "homework",
          homeworkId
        ),
        data,
        {
          merge: false
        }
      );


      /* DELETE REMOVED FILES */

      if (oldHomework) {

        const oldAttachments =
          normalizeAttachments(
            oldHomework
          );


        const newPaths =
          new Set(
            attachments
              .map(
                (item) =>
                  item.storagePath
              )
              .filter(Boolean)
          );


        const removed =
          oldAttachments.filter(
            (item) =>
              item.storagePath &&
              !newPaths.has(
                item.storagePath
              )
          );


        if (removed.length) {

          await deleteStorageFiles(
            removed
          );
        }
      }


      if (progressEl) {

        progressEl.textContent =
          "✅ Đã lưu bài tập.";
      }


      closeDialog(
        "homeworkDialog"
      );

    } catch (error) {

      console.error(
        "Save homework error:",
        error
      );


      if (errorEl) {

        errorEl.textContent =
          `Không thể lưu: ${
            error?.message ||
            "Lỗi không xác định"
          }`;
      }

    } finally {

      if (saveButton) {
        saveButton.disabled = false;
      }
    }
  }
);


/* =========================================================
   EDIT / DELETE
   ========================================================= */

document.addEventListener(
  "click",
  (event) => {

    const button =
      event.target.closest(
        "button[data-action]"
      );


    if (!button) return;


    const id =
      button.dataset.id;

    const action =
      button.dataset.action;


    if (
      action ===
      "edit-homework"
    ) {

      editHomework(id);
    }


    if (
      action ===
      "delete-homework"
    ) {

      removeHomework(id);
    }


    if (
      action ===
      "edit-subject"
    ) {

      editSubject(id);
    }


    if (
      action ===
      "delete-subject"
    ) {

      removeSubject(id);
    }
  }
);


/* =========================================================
   EDIT HOMEWORK
   ========================================================= */

function editHomework(id) {

  const homework =
    homeworks.find(
      (item) =>
        item.id === id
    );


  if (!homework) return;


  if ($("hwDialogTitle")) {

    $("hwDialogTitle").textContent =
      "Sửa bài tập";
  }


  if ($("hwId")) {
    $("hwId").value =
      homework.id;
  }


  fillSubjectSelect(
    homework.subjectId || ""
  );


  if ($("hwTitle")) {
    $("hwTitle").value =
      homework.title || "";
  }


  if ($("hwContent")) {
    $("hwContent").value =
      homework.content || "";
  }


  if ($("hwDue")) {
    $("hwDue").value =
      homework.dueDate || "";
  }


  if ($("hwPinned")) {
    $("hwPinned").checked =
      !!homework.pinned;
  }


  if ($("hwImportant")) {
    $("hwImportant").checked =
      !!homework.important;
  }


  if ($("hwError")) {
    $("hwError").textContent = "";
  }


  if ($("hwUploadProgress")) {
    $("hwUploadProgress").textContent =
      "";
  }


  clearAttachmentRows();


  attachmentRowsFromHomework(
    homework
  );


  showDialog(
    "homeworkDialog"
  );
}


/* =========================================================
   DELETE HOMEWORK
   ========================================================= */

async function removeHomework(id) {

  if (
    !confirm(
      "Bạn có chắc muốn xóa bài tập này?"
    )
  ) {

    return;
  }


  const homework =
    homeworks.find(
      (item) =>
        item.id === id
    );


  try {

    await deleteDoc(
      doc(
        db,
        "homework",
        id
      )
    );


    if (homework) {

      await deleteStorageFiles(
        normalizeAttachments(
          homework
        )
      );
    }

  } catch (error) {

    console.error(
      "Delete homework error:",
      error
    );


    alert(
      `Không thể xóa: ${
        error?.message ||
        "Lỗi không xác định"
      }`
    );
  }
}


/* =========================================================
   EDIT SUBJECT
   ========================================================= */

function editSubject(id) {

  const subject =
    subjects.find(
      (item) =>
        item.id === id
    );


  if (!subject) return;


  if ($("tabId")) {
    $("tabId").value = id;
  }


  if ($("tabName")) {
    $("tabName").value =
      subject.name || "";
  }


  if ($("tabIcon")) {
    $("tabIcon").value =
      subject.icon || "";
  }


  if ($("tabDialogTitle")) {

    $("tabDialogTitle").textContent =
      "Sửa môn học";
  }


  if ($("tabError")) {
    $("tabError").textContent = "";
  }


  showDialog(
    "tabDialog"
  );
}


/* =========================================================
   DELETE SUBJECT
   ========================================================= */

async function removeSubject(id) {

  if (
    homeworks.some(
      (item) =>
        item.subjectId === id
    )
  ) {

    alert(
      "Môn này đang có bài tập. Hãy chuyển hoặc xóa các bài tập thuộc môn này trước."
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
      `Không thể xóa: ${
        error?.message ||
        "Lỗi không xác định"
      }`
    );
  }
}


/* =========================================================
   MANAGEMENT PANEL
   ========================================================= */

function ensureManagementPanel() {

  if (
    !$("dashboard") ||
    $("advancedAdminPanel")
  ) {

    return;
  }


  const panel =
    document.createElement(
      "section"
    );


  panel.id =
    "advancedAdminPanel";

  panel.className =
    "panel advanced-admin-panel";


  panel.innerHTML = `

    <div class="admin-section">

      <div class="panel-title">

        <h2>
          👥 Quản lý người dùng
        </h2>

        <button
          type="button"
          id="refreshUsers"
          class="ghost small"
        >
          ↻ Làm mới
        </button>

      </div>


      <div class="stats admin-user-stats">

        <div>
          <b id="statUsers">0</b>
          <span>Người dùng</span>
        </div>

        <div>
          <b id="statVisitedToday">0</b>
          <span>Đã truy cập hôm nay</span>
        </div>

        <div>
          <b id="statTotalStreak">0</b>
          <span>Tổng streak</span>
        </div>

      </div>


      <input
        id="userSearch"
        class="admin-search"
        type="search"
        placeholder="🔎 Tìm theo tên, username hoặc Gmail..."
      >


      <div
        id="adminUsers"
        class="admin-list"
      >
        <p class="muted">
          Đang tải người dùng...
        </p>
      </div>

    </div>


    <div class="admin-section">

      <div class="panel-title">

        <h2>
          🔔 Cài đặt thông báo
        </h2>

      </div>


      <div
        id="adminSettings"
        class="admin-settings"
      >
        <p class="muted">
          Đang tải...
        </p>
      </div>

    </div>

  `;


  $("dashboard")
    .appendChild(panel);


  $("userSearch")?.addEventListener(
    "input",
    (event) => {

      userSearchText =
        event.target.value
          .trim()
          .toLowerCase();


      renderUsers();
    }
  );


  $("refreshUsers")?.addEventListener(
    "click",
    () => {

      renderUsers();
      updateAllStats();
    }
  );
}


/* =========================================================
   USERS
   ========================================================= */

function renderUsers() {

  const container =
    $("adminUsers");

  if (!container) return;


  let filtered =
    [...users];


  if (userSearchText) {

    filtered =
      filtered.filter(
        (user) => {

          const text = [

            user.email,

            user.displayName,

            user.username,

            user.name,

            user.id

          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();


          return text.includes(
            userSearchText
          );
        }
      );
  }


  filtered.sort(
    (a, b) =>
      new Date(
        getUserLastAccess(b) || 0
      ) -
      new Date(
        getUserLastAccess(a) || 0
      )
  );


  if (!filtered.length) {

    container.innerHTML =
      `<p class="muted">${
        users.length
          ? "Không tìm thấy người dùng phù hợp."
          : "Chưa có người dùng nào."
      }</p>`;

    return;
  }


  const today =
    todayKey();


  container.innerHTML =
    filtered
      .map(
        (user) => {

          const last =
            getUserLastAccess(
              user
            );


          const lastDate =
            dateKeyFromValue(
              last
            ) ||
            user.lastVisitDate ||
            user.lastLoginDate ||
            "";


          return `
            <div class="admin-item user-admin-item">

              <div>

                <b>
                  ${esc(
                    getUserName(
                      user
                    )
                  )}
                </b>

                <small>
                  📧 ${
                    esc(
                      user.email ||
                      "Không có email"
                    )
                  }
                </small>

                <small>
                  🆔 ${
                    esc(
                      user.id
                    )
                  }
                </small>

                <small>
                  🔥 Streak:
                  <strong>
                    ${getUserStreak(
                      user
                    )}
                  </strong>

                  ·

                  🏆 Cao nhất:
                  <strong>
                    ${getUserLongest(
                      user
                    )}
                  </strong>
                </small>

                <small>
                  🕒 Truy cập:
                  ${esc(
                    formatDate(
                      last
                    )
                  )}

                  ${
                    lastDate === today
                      ? " · 🟢 Hôm nay"
                      : ""
                  }
                </small>

              </div>


              <div class="actions">

                <button
                  type="button"
                  data-user-edit="${esc(
                    user.id
                  )}"
                >
                  Sửa
                </button>

              </div>

            </div>
          `;
        }
      )
      .join("");
}


/* USER EDIT BUTTON */

document.addEventListener(
  "click",
  (event) => {

    const button =
      event.target.closest(
        "button[data-user-edit]"
      );


    if (!button) return;


    openUserEditor(
      button.dataset.userEdit
    );
  }
);


/* =========================================================
   USER STATS
   ========================================================= */

function updateUserStats() {

  const today =
    todayKey();


  const visitedToday =
    users.filter(
      (user) => {

        const last =
          getUserLastAccess(
            user
          );


        const date =
          dateKeyFromValue(
            last
          ) ||
          user.lastVisitDate ||
          user.lastLoginDate ||
          "";


        return date === today;
      }
    ).length;


  const totalStreak =
    users.reduce(
      (sum, user) =>
        sum +
        getUserStreak(
          user
        ),
      0
    );


  if ($("statUsers")) {

    $("statUsers").textContent =
      String(users.length);
  }


  if ($("statVisitedToday")) {

    $("statVisitedToday").textContent =
      String(visitedToday);
  }


  if ($("statTotalStreak")) {

    $("statTotalStreak").textContent =
      String(totalStreak);
  }
}


function updateAllStats() {

  updateUserStats();


  if ($("statHomework")) {

    $("statHomework").textContent =
      String(
        homeworks.length
      );
  }


  if ($("statTabs")) {

    $("statTabs").textContent =
      String(
        subjects.length
      );
  }


  if ($("statPinned")) {

    $("statPinned").textContent =
      String(
        homeworks.filter(
          (item) =>
            item.pinned
        ).length
      );
  }
}


/* =========================================================
   USER EDITOR
   ========================================================= */

function openUserEditor(id) {

  const user =
    users.find(
      (item) =>
        item.id === id
    );


  if (!user) return;


  $("userEditorModal")?.remove();


  const modal =
    document.createElement(
      "div"
    );


  modal.id =
    "userEditorModal";


  modal.innerHTML = `

    <div class="admin-modal-backdrop">

      <div
        class="admin-modal"
        role="dialog"
        aria-modal="true"
      >

        <div class="admin-modal-header">

          <h2>
            ✏️ Sửa người dùng
          </h2>

          <button
            type="button"
            id="closeUserEditor"
            class="icon-btn"
          >
            ×
          </button>

        </div>


        <div class="admin-form">

          <label>
            UID

            <input
              id="editUserUid"
              value="${esc(user.id)}"
              readonly
            >
          </label>


          <label>
            Email profile

            <input
              id="editUserEmail"
              type="email"
              value="${esc(
                user.email || ""
              )}"
            >
          </label>


          <label>
            Username

            <input
              id="editUserUsername"
              value="${esc(
                user.username || ""
              )}"
            >
          </label>


          <label>
            Tên hiển thị

            <input
              id="editUserDisplayName"
              value="${esc(
                user.displayName ||
                user.name ||
                ""
              )}"
            >
          </label>


          <label>
            🔥 Streak

            <input
              id="editUserStreak"
              type="number"
              min="0"
              value="${getUserStreak(
                user
              )}"
            >
          </label>


          <label>
            🏆 Streak cao nhất

            <input
              id="editUserLongestStreak"
              type="number"
              min="0"
              value="${getUserLongest(
                user
              )}"
            >
          </label>


          <label>
            📅 Ngày truy cập cuối

            <input
              id="editUserLastVisit"
              value="${esc(
                user.lastVisitDate ||
                ""
              )}"
              placeholder="YYYY-MM-DD"
            >
          </label>


          <div class="actions">

            <button
              type="button"
              id="saveUserChanges"
              class="primary"
            >
              💾 Lưu thay đổi
            </button>

            <button
              type="button"
              id="deleteUserProfile"
              class="danger"
            >
              🗑️ Xóa profile
            </button>

          </div>


          <p class="muted">
            Sửa Email ở đây chỉ sửa
            profile Firestore, không đổi
            tài khoản Google Authentication.
          </p>


          <p
            id="userEditorError"
            class="error"
          ></p>

        </div>

      </div>

    </div>

  `;


  document.body.appendChild(
    modal
  );


  $("closeUserEditor")
    ?.addEventListener(
      "click",
      () => modal.remove()
    );


  modal
    .querySelector(
      ".admin-modal-backdrop"
    )
    ?.addEventListener(
      "click",
      (event) => {

        if (
          event.target.classList.contains(
            "admin-modal-backdrop"
          )
        ) {

          modal.remove();
        }
      }
    );


  /* SAVE USER */

  $("saveUserChanges")
    ?.addEventListener(
      "click",
      async () => {

        const errorEl =
          $("userEditorError");


        const email =
          $("editUserEmail")
            ?.value
            .trim() || "";


        const username =
          $("editUserUsername")
            ?.value
            .trim() || "";


        const displayName =
          $("editUserDisplayName")
            ?.value
            .trim() || "";


        const streak =
          Math.max(
            0,
            Math.floor(
              normalizeNumber(
                $("editUserStreak")
                  ?.value
              )
            )
          );


        const longest =
          Math.max(
            streak,
            Math.floor(
              normalizeNumber(
                $("editUserLongestStreak")
                  ?.value
              )
            )
          );


        const lastVisit =
          $("editUserLastVisit")
            ?.value
            .trim() || "";


        if (
          email &&
          !/^\S+@\S+\.\S+$/.test(
            email
          )
        ) {

          if (errorEl) {

            errorEl.textContent =
              "Email không hợp lệ.";
          }

          return;
        }


        if (
          lastVisit &&
          !/^\d{4}-\d{2}-\d{2}$/.test(
            lastVisit
          )
        ) {

          if (errorEl) {

            errorEl.textContent =
              "Ngày phải có dạng YYYY-MM-DD.";
          }

          return;
        }


        try {

          await setDoc(
            doc(
              db,
              "users",
              id
            ),
            {

              email,

              username,

              displayName,

              name:
                displayName,

              streak,

              currentStreak:
                streak,

              longestStreak:
                longest,

              highestStreak:
                longest,

              maxStreak:
                longest,

              lastVisitDate:
                lastVisit,

              updatedAt:
                serverTimestamp()

            },
            {
              merge: true
            }
          );


          modal.remove();

        } catch (error) {

          console.error(
            "Save user error:",
            error
          );


          if (errorEl) {

            errorEl.textContent =
              `Không thể lưu: ${
                error.message
              }`;
          }
        }
      }
    );


  /* DELETE USER PROFILE */

  $("deleteUserProfile")
    ?.addEventListener(
      "click",
      async () => {

        if (
          !confirm(
            "Xóa profile Firestore? Tài khoản Google Authentication không bị xóa."
          )
        ) {

          return;
        }


        try {

          await deleteDoc(
            doc(
              db,
              "users",
              id
            )
          );


          modal.remove();

        } catch (error) {

          console.error(
            "Delete user error:",
            error
          );


          alert(
            `Không thể xóa: ${
              error.message
            }`
          );
        }
      }
    );
}


/* =========================================================
   SETTINGS
   ========================================================= */

async function saveSiteSettings(
  changes
) {

  await setDoc(
    doc(
      db,
      "settings",
      "site"
    ),
    {
      ...changes,
      updatedAt:
        serverTimestamp()
    },
    {
      merge: true
    }
  );
}


function renderSiteSettings() {

  const container =
    $("adminSettings");

  if (!container) return;


  container.innerHTML = `

    <div class="admin-setting-row">

      <div>

        <b>
          Thông báo không có bài mới
        </b>

        <small>
          Khi hôm nay chưa có bài tập mới.
        </small>

      </div>


      <label class="switch">

        <input
          type="checkbox"
          id="noHomeworkNoticeToggle"
          ${
            siteSettings.noHomeworkNoticeEnabled !== false
              ? "checked"
              : ""
          }
        >

        <span></span>

      </label>

    </div>


    <div class="admin-setting-row">

      <div>

        <b>
          Thông báo bài tập cũ
        </b>

        <small>
          Khi danh sách chưa được cập nhật.
        </small>

      </div>


      <label class="switch">

        <input
          type="checkbox"
          id="oldHomeworkNoticeToggle"
          ${
            siteSettings.oldHomeworkNoticeEnabled !== false
              ? "checked"
              : ""
          }
        >

        <span></span>

      </label>

    </div>


    <details class="admin-setting-details">

      <summary>
        ✏️ Chỉnh nội dung thông báo
      </summary>


      <label>

        Tiêu đề không có bài mới

        <input
          id="noHomeworkNoticeTitle"
          maxlength="120"
          value="${esc(
            siteSettings.noHomeworkNoticeTitle
          )}"
        >

      </label>


      <label>

        Nội dung không có bài mới

        <textarea
          id="noHomeworkNoticeMessage"
          rows="3"
        >${esc(
          siteSettings.noHomeworkNoticeMessage
        )}</textarea>

      </label>


      <label>

        Tiêu đề bài tập cũ

        <input
          id="oldHomeworkNoticeTitle"
          maxlength="120"
          value="${esc(
            siteSettings.oldHomeworkNoticeTitle
          )}"
        >

      </label>


      <label>

        Nội dung bài tập cũ

        <textarea
          id="oldHomeworkNoticeMessage"
          rows="3"
        >${esc(
          siteSettings.oldHomeworkNoticeMessage
        )}</textarea>

      </label>


      <button
        type="button"
        id="saveNoticeTexts"
        class="primary"
      >
        💾 Lưu nội dung
      </button>

    </details>

  `;


  /* TOGGLE 1 */

  $("noHomeworkNoticeToggle")
    ?.addEventListener(
      "change",
      async (event) => {

        try {

          await saveSiteSettings({
            noHomeworkNoticeEnabled:
              event.target.checked
          });

        } catch (error) {

          console.error(
            "Save notice toggle:",
            error
          );

          event.target.checked =
            !event.target.checked;
        }
      }
    );


  /* TOGGLE 2 */

  $("oldHomeworkNoticeToggle")
    ?.addEventListener(
      "change",
      async (event) => {

        try {

          await saveSiteSettings({
            oldHomeworkNoticeEnabled:
              event.target.checked
          });

        } catch (error) {

          console.error(
            "Save notice toggle:",
            error
          );

          event.target.checked =
            !event.target.checked;
        }
      }
    );


  /* SAVE TEXT */

  $("saveNoticeTexts")
    ?.addEventListener(
      "click",
      async () => {

        const button =
          $("saveNoticeTexts");


        if (button) {
          button.disabled = true;
        }


        try {

          await saveSiteSettings({

            noHomeworkNoticeTitle:
              $("noHomeworkNoticeTitle")
                ?.value
                .trim() ||
              "📚 Hôm nay không có bài tập mới",

            noHomeworkNoticeMessage:
              $("noHomeworkNoticeMessage")
                ?.value
                .trim() ||
              "Hôm nay chưa có bài tập mới được cập nhật.",

            oldHomeworkNoticeTitle:
              $("oldHomeworkNoticeTitle")
                ?.value
                .trim() ||
              "📢 Bài tập chưa có cập nhật",

            oldHomeworkNoticeMessage:
              $("oldHomeworkNoticeMessage")
                ?.value
                .trim() ||
              "Danh sách bài tập hôm nay vẫn giống ngày trước."
          });


          alert(
            "Đã lưu cài đặt."
          );

        } catch (error) {

          console.error(
            "Save settings error:",
            error
          );


          alert(
            `Không thể lưu: ${
              error.message
            }`
          );

        } finally {

          if (button) {
            button.disabled = false;
          }
        }
      }
    );
}


/* =========================================================
   GLOBAL API
   ========================================================= */

window.HomeworkAdmin = {

  get state() {

    return {
      subjects,
      homeworks,
      users,
      siteSettings
    };
  },

  refreshUsers:
    renderUsers,

  refreshSettings:
    renderSiteSettings,

  editUser:
    openUserEditor
};


console.log(
  "Homework Hub Admin: ready"
);
