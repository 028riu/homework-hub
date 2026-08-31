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


// ======================================================
// FIREBASE
// ======================================================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);

const provider = new GoogleAuthProvider();


// ======================================================
// ADMIN
// ======================================================

// Tài khoản Google duy nhất được phép quản trị
const ADMIN_EMAIL = "028riu@gmail.com";

let subjects = [];
let homeworks = [];
let started = false;


// ======================================================
// GOOGLE LOGIN
// ======================================================

$("googleLoginBtn").addEventListener("click", async () => {

    $("loginError").textContent = "";

    try {

        await signInWithPopup(auth, provider);

    } catch (error) {

        console.error("Google Login Error:", error);

        $("loginError").textContent =
            "Không thể đăng nhập: " +
            (error.code || error.message);

    }

});


// ======================================================
// LOGOUT
// ======================================================

$("logoutBtn").addEventListener("click", async () => {

    try {

        await signOut(auth);

    } catch (error) {

        console.error("Logout Error:", error);

    }

});


// ======================================================
// AUTH STATE
// ======================================================

onAuthStateChanged(auth, (user) => {

    const loginView = $("loginView");
    const dashboard = $("dashboard");

    if (!user) {

        loginView.classList.remove("hidden");
        dashboard.classList.add("hidden");

        started = false;

        return;
    }


    // ==============================================
    // KIỂM TRA ADMIN
    // ==============================================

    if (
        !user.email ||
        user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()
    ) {

        loginView.classList.remove("hidden");
        dashboard.classList.add("hidden");

        $("loginError").textContent =
            `Tài khoản ${user.email || "này"} không có quyền quản trị.`;

        signOut(auth);

        return;
    }


    // ==============================================
    // ADMIN HỢP LỆ
    // ==============================================

    loginView.classList.add("hidden");
    dashboard.classList.remove("hidden");

    $("adminUser").textContent =
        `${user.displayName || "Admin"} · ${user.email}`;

    start();

});


// ======================================================
// FIRESTORE
// ======================================================

function start() {

    if (started) return;

    started = true;


    // ==================================================
    // SUBJECTS
    // ==================================================

    const subjectsQuery = query(
        collection(db, "subjects"),
        orderBy("order", "asc")
    );

    onSnapshot(
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

            console.error("Subjects error:", error);

        }
    );


    // ==================================================
    // HOMEWORK
    // ==================================================

    const homeworkQuery = query(
        collection(db, "homework"),
        orderBy("createdAt", "desc")
    );

    onSnapshot(
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

            console.error("Homework error:", error);

        }
    );

}


// ======================================================
// RENDER SUBJECTS
// ======================================================

function renderSubjects() {

    const container = $("adminTabs");

    if (!subjects.length) {

        container.innerHTML = `
            <p class="muted">
                Chưa có môn học.
            </p>
        `;

        return;
    }


    container.innerHTML = subjects.map((subject) => {

        return `
            <div class="admin-item">

                <b>
                    ${esc(subject.icon || "📚")}
                    ${esc(subject.name || "Môn học")}
                </b>

                <div class="actions">

                    <button
                        type="button"
                        onclick="editSubject('${subject.id}')">
                        Sửa
                    </button>

                    <button
                        type="button"
                        class="danger"
                        onclick="removeSubject('${subject.id}')">
                        Xóa
                    </button>

                </div>

            </div>
        `;

    }).join("");

}


// ======================================================
// RENDER HOMEWORK
// ======================================================

function renderHomework() {

    const container = $("adminHomework");

    if (!homeworks.length) {

        container.innerHTML = `
            <p class="muted">
                Chưa có bài tập.
            </p>
        `;

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
                    · ${esc(dueText)}
                </small>

                <div class="actions">

                    <button
                        type="button"
                        onclick="editHomework('${homework.id}')">
                        Sửa
                    </button>

                    <button
                        type="button"
                        class="danger"
                        onclick="removeHomework('${homework.id}')">
                        Xóa
                    </button>

                </div>

            </div>
        `;

    }).join("");

}


// ======================================================
// SUBJECT SELECT
// ======================================================

function fillSubjectSelect() {

    const select = $("hwTab");

    if (!subjects.length) {

        select.innerHTML = `
            <option value="">
                Chưa có môn học
            </option>
        `;

        return;
    }


    select.innerHTML = subjects.map((subject) => {

        return `
            <option value="${subject.id}">
                ${esc(subject.icon || "📚")}
                ${esc(subject.name || "Môn học")}
            </option>
        `;

    }).join("");

}


// ======================================================
// STATISTICS
// ======================================================

function updateStats() {

    $("statHomework").textContent =
        homeworks.length;

    $("statTabs").textContent =
        subjects.length;

    $("statPinned").textContent =
        homeworks.filter(
            (homework) => homework.pinned
        ).length;

}


// ======================================================
// CREATE HOMEWORK
// ======================================================

$("newHomework").addEventListener("click", () => {

    if (!subjects.length) {

        alert(
            "Hãy tạo ít nhất 1 môn học trước."
        );

        return;
    }


    $("hwDialogTitle").textContent =
        "Tạo bài tập";

    $("homeworkForm").reset();

    $("hwId").value = "";

    $("hwError").textContent = "";

    fillSubjectSelect();

    $("homeworkDialog").showModal();

});


// ======================================================
// SAVE HOMEWORK
// ======================================================

$("homeworkForm").addEventListener("submit", async (event) => {

    event.preventDefault();


    const id = $("hwId").value;


    // Kiểm tra dữ liệu
    const title = $("hwTitle").value.trim();
    const content = $("hwContent").value.trim();
    const subjectId = $("hwTab").value;


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


    const data = {

        subjectId: subjectId,

        title: title,

        content: content,

        dueDate:
            $("hwDue").value || null,

        pinned:
            $("hwPinned").checked,

        important:
            $("hwImportant").checked,

        updatedAt:
            serverTimestamp()

    };


    // Giữ nguyên createdAt khi sửa
    if (id) {

        const oldHomework =
            homeworks.find(
                (homework) => homework.id === id
            );

        data.createdAt =
            oldHomework?.createdAt ||
            serverTimestamp();

    } else {

        data.createdAt =
            serverTimestamp();

    }


    try {

        const documentId =
            id || crypto.randomUUID();

        await setDoc(
            doc(db, "homework", documentId),
            data
        );


        $("homeworkDialog").close();

        $("hwError").textContent = "";


    } catch (error) {

        console.error(
            "Save homework error:",
            error
        );

        $("hwError").textContent =
            "Không thể lưu: " +
            error.message;

    }

});


// ======================================================
// CREATE SUBJECT
// ======================================================

$("newTab").addEventListener("click", () => {

    $("tabDialogTitle").textContent =
        "Tạo môn học";

    $("tabForm").reset();

    $("tabId").value = "";

    $("tabError").textContent = "";

    $("tabDialog").showModal();

});


// ======================================================
// SAVE SUBJECT
// ======================================================

$("tabForm").addEventListener("submit", async (event) => {

    event.preventDefault();


    const id = $("tabId").value;


    const name =
        $("tabName").value.trim();

    const icon =
        $("tabIcon").value.trim() || "📚";


    if (!name) {

        $("tabError").textContent =
            "Vui lòng nhập tên môn học.";

        return;
    }


    const oldSubject =
        subjects.find(
            (subject) => subject.id === id
        );


    let subjectOrder;


    if (id) {

        subjectOrder =
            oldSubject?.order || 0;

    } else {

        subjectOrder =
            subjects.length
                ? Math.max(
                    ...subjects.map(
                        (subject) =>
                            subject.order || 0
                    )
                ) + 1
                : 1;

    }


    const data = {

        name: name,

        icon: icon,

        order: subjectOrder,

        updatedAt:
            serverTimestamp()

    };


    try {

        const documentId =
            id || crypto.randomUUID();

        await setDoc(
            doc(db, "subjects", documentId),
            data
        );


        $("tabDialog").close();

        $("tabError").textContent = "";


    } catch (error) {

        console.error(
            "Save subject error:",
            error
        );

        $("tabError").textContent =
            "Không thể lưu: " +
            error.message;

    }

});


// ======================================================
// EDIT HOMEWORK
// ======================================================

window.editHomework = (id) => {

    const homework =
        homeworks.find(
            (item) => item.id === id
        );

    if (!homework) return;


    $("hwDialogTitle").textContent =
        "Sửa bài tập";

    $("hwId").value =
        homework.id;


    fillSubjectSelect();


    $("hwTab").value =
        homework.subjectId || "";


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

};


// ======================================================
// DELETE HOMEWORK
// ======================================================

window.removeHomework = async (id) => {

    if (
        !confirm(
            "Bạn có chắc muốn xóa bài tập này?"
        )
    ) {

        return;
    }


    try {

        await deleteDoc(
            doc(db, "homework", id)
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

};


// ======================================================
// EDIT SUBJECT
// ======================================================

window.editSubject = (id) => {

    const subject =
        subjects.find(
            (item) => item.id === id
        );

    if (!subject) return;


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

};


// ======================================================
// DELETE SUBJECT
// ======================================================

window.removeSubject = async (id) => {

    const hasHomework =
        homeworks.some(
            (homework) =>
                homework.subjectId === id
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
            doc(db, "subjects", id)
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

};


// ======================================================
// ESCAPE HTML
// ======================================================

function esc(value = "") {

    return String(value)
        .replace(
            /[&<>"']/g,
            (character) => {

                const entities = {

                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;"

                };

                return entities[character];

            }
        );

}
