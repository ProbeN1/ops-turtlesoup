const form = document.querySelector("#feedbackForm");
const contentInput = document.querySelector("#feedbackContent");
const contactInput = document.querySelector("#feedbackContact");
const submitBtn = document.querySelector("#feedbackSubmit");
const statusText = document.querySelector("#feedbackStatus");
const mailtoFallback = document.querySelector("#mailtoFallback");

form.addEventListener("submit", submitFeedback);

async function submitFeedback(event) {
  event.preventDefault();
  const content = contentInput.value.trim();
  const contact = contactInput.value.trim();
  if (!content) return;

  submitBtn.disabled = true;
  statusText.textContent = "发送中...";
  mailtoFallback.hidden = true;

  try {
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content,
        contact,
        page: window.location.href
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "发送失败");

    form.reset();
    statusText.textContent = "已发送，谢谢反馈。";
  } catch (error) {
    statusText.textContent = error.message;
    mailtoFallback.href = mailtoLink(content, contact);
    mailtoFallback.hidden = false;
  } finally {
    submitBtn.disabled = false;
  }
}

function mailtoLink(content, contact) {
  const subject = encodeURIComponent("运维海龟汤用户反馈");
  const body = encodeURIComponent([
    content,
    "",
    `联系方式：${contact || "未填写"}`,
    `页面：${window.location.href}`
  ].join("\n"));
  return `mailto:532015746@qq.com?subject=${subject}&body=${body}`;
}
